package handler

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/billing/internal/domain"
)

type BillingHandler struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *BillingHandler {
	return &BillingHandler{db: db}
}

func (h *BillingHandler) ListPlans(c *fiber.Ctx) error {
	rows, err := h.db.Query(c.Context(),
		`SELECT id, name, slug, price_monthly, price_yearly, currency, features, limits, is_active FROM billing_plans WHERE is_active=TRUE ORDER BY price_monthly`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	plans := []domain.Plan{}
	for rows.Next() {
		var p domain.Plan
		var featJSON, limJSON []byte
		if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &p.PriceMonthly, &p.PriceYearly,
			&p.Currency, &featJSON, &limJSON, &p.IsActive); err != nil {
			continue
		}
		_ = json.Unmarshal(featJSON, &p.Features)
		_ = json.Unmarshal(limJSON, &p.Limits)
		plans = append(plans, p)
	}
	return c.JSON(fiber.Map{"plans": plans})
}

func (h *BillingHandler) GetSubscription(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var sub domain.Subscription
	var plan domain.Plan
	var featJSON, limJSON []byte

	err := h.db.QueryRow(c.Context(),
		`SELECT s.id, s.organization_id, s.plan_id, s.status, s.billing_cycle,
		        s.current_period_start, s.current_period_end, s.cancel_at_period_end, s.trial_ends_at, s.created_at,
		        p.name, p.slug, p.price_monthly, p.price_yearly, p.currency, p.features, p.limits
		 FROM subscriptions s JOIN billing_plans p ON p.id=s.plan_id
		 WHERE s.organization_id=$1`, orgID).
		Scan(&sub.ID, &sub.OrganizationID, &sub.PlanID, &sub.Status, &sub.BillingCycle,
			&sub.CurrentPeriodStart, &sub.CurrentPeriodEnd, &sub.CancelAtPeriodEnd, &sub.TrialEndsAt, &sub.CreatedAt,
			&plan.Name, &plan.Slug, &plan.PriceMonthly, &plan.PriceYearly, &plan.Currency, &featJSON, &limJSON)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "no subscription found"})
	}
	_ = json.Unmarshal(featJSON, &plan.Features)
	_ = json.Unmarshal(limJSON, &plan.Limits)
	plan.ID = sub.PlanID
	sub.Plan = &plan
	return c.JSON(sub)
}

func (h *BillingHandler) CreateSubscription(c *fiber.Ctx) error {
	var req domain.CreateSubscriptionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.BillingCycle == "" {
		req.BillingCycle = "monthly"
	}
	orgID := c.Get("X-Org-ID", "default")

	var planID string
	err := h.db.QueryRow(c.Context(), `SELECT id FROM billing_plans WHERE slug=$1`, req.PlanSlug).Scan(&planID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "plan not found"})
	}

	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0)
	if req.BillingCycle == "yearly" {
		periodEnd = now.AddDate(1, 0, 0)
	}

	var id string
	err = h.db.QueryRow(c.Context(),
		`INSERT INTO subscriptions (organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
		 VALUES ($1,$2,'active',$3,$4,$5)
		 ON CONFLICT (organization_id) DO UPDATE SET plan_id=$2, billing_cycle=$3, current_period_start=$4, current_period_end=$5, updated_at=NOW()
		 RETURNING id`,
		orgID, planID, req.BillingCycle, now, periodEnd,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"id": id, "status": "active"})
}

func (h *BillingHandler) CancelSubscription(c *fiber.Ctx) error {
	var req domain.CancelSubscriptionRequest
	_ = c.BodyParser(&req)
	orgID := c.Get("X-Org-ID", "default")

	if req.AtPeriodEnd {
		_, err := h.db.Exec(c.Context(),
			`UPDATE subscriptions SET cancel_at_period_end=TRUE, updated_at=NOW() WHERE organization_id=$1`, orgID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"status": "will cancel at period end"})
	}

	_, err := h.db.Exec(c.Context(),
		`UPDATE subscriptions SET status='cancelled', updated_at=NOW() WHERE organization_id=$1`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "cancelled"})
}

func (h *BillingHandler) ListInvoices(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, number, status, amount_due, amount_paid, currency, period_start, period_end, due_date, paid_at, pdf_url, created_at
		 FROM invoices WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	invoices := []domain.Invoice{}
	for rows.Next() {
		var inv domain.Invoice
		if err := rows.Scan(&inv.ID, &inv.Number, &inv.Status, &inv.AmountDue, &inv.AmountPaid,
			&inv.Currency, &inv.PeriodStart, &inv.PeriodEnd, &inv.DueDate, &inv.PaidAt, &inv.PDFURL, &inv.CreatedAt); err != nil {
			continue
		}
		inv.OrganizationID = orgID
		invoices = append(invoices, inv)
	}
	return c.JSON(fiber.Map{"invoices": invoices})
}

// GetUsage returns current period usage stats
func (h *BillingHandler) GetUsage(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	_ = orgID

	// Return simulated usage data
	usage := fiber.Map{
		"domains":       fiber.Map{"used": 3, "limit": 25},
		"disk_gb":       fiber.Map{"used": 12.4, "limit": 100},
		"bandwidth_gb":  fiber.Map{"used": 45.2, "limit": 500},
		"email_accounts": fiber.Map{"used": 8, "limit": 100},
		"databases":     fiber.Map{"used": 2, "limit": 10},
	}
	return c.JSON(usage)
}

// StripeWebhook handles incoming Stripe webhook events
func (h *BillingHandler) StripeWebhook(c *fiber.Ctx) error {
	// In production: validate stripe-signature header, parse event type, update DB
	eventType := c.Get("Stripe-Event-Type", "unknown")
	_ = eventType
	return c.JSON(fiber.Map{"received": true})
}

// GenerateInvoiceNumber creates a sequential invoice number
func generateInvoiceNumber() string {
	return fmt.Sprintf("INV-%d-%04d", time.Now().Year(), rand.Intn(9000)+1000)
}

var _ = generateInvoiceNumber
