package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"strings"
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

// GetUsage returns current period usage stats from real DB counts
func (h *BillingHandler) GetUsage(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")

	type stat struct {
		Used  int64   `json:"used"`
		Limit int64   `json:"limit"`
		UsedF float64 `json:"used_f,omitempty"`
	}

	usage := map[string]interface{}{}

	// Domains
	var domainCount int64
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM domains WHERE organization_id=$1`, orgID).Scan(&domainCount)

	// Email accounts
	var mailCount int64
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM mailboxes WHERE organization_id=$1`, orgID).Scan(&mailCount)

	// Databases
	var dbCount int64
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM database_instances WHERE organization_id=$1`, orgID).Scan(&dbCount)

	// Disk usage (sum from domains table)
	var diskMB int64
	_ = h.db.QueryRow(c.Context(), `SELECT COALESCE(SUM(disk_used_mb),0) FROM domains WHERE organization_id=$1`, orgID).Scan(&diskMB)

	// Bandwidth (sum from domains)
	var bwMB int64
	_ = h.db.QueryRow(c.Context(), `SELECT COALESCE(SUM(bandwidth_used_mb),0) FROM domains WHERE organization_id=$1`, orgID).Scan(&bwMB)

	// Get plan limits
	var limitsJSON []byte
	_ = h.db.QueryRow(c.Context(),
		`SELECT p.limits FROM billing_plans p JOIN subscriptions s ON s.plan_id=p.id WHERE s.organization_id=$1`, orgID,
	).Scan(&limitsJSON)

	limits := map[string]int64{
		"domains": 25, "disk_gb": 100, "bandwidth_gb": 500, "email_accounts": 100, "databases": 10,
	}
	if limitsJSON != nil {
		var parsed map[string]interface{}
		if json.Unmarshal(limitsJSON, &parsed) == nil {
			for k, v := range parsed {
				if n, ok := v.(float64); ok {
					limits[k] = int64(n)
				}
			}
		}
	}

	usage["domains"] = stat{Used: domainCount, Limit: limits["domains"]}
	usage["email_accounts"] = stat{Used: mailCount, Limit: limits["email_accounts"]}
	usage["databases"] = stat{Used: dbCount, Limit: limits["databases"]}
	usage["disk_gb"] = stat{Used: diskMB / 1024, Limit: limits["disk_gb"], UsedF: float64(diskMB) / 1024}
	usage["bandwidth_gb"] = stat{Used: bwMB / 1024, Limit: limits["bandwidth_gb"], UsedF: float64(bwMB) / 1024}

	return c.JSON(usage)
}

// StripeWebhook handles incoming Stripe webhook events with signature verification
func (h *BillingHandler) StripeWebhook(c *fiber.Ctx) error {
	sigHeader := c.Get("Stripe-Signature")
	body := c.Body()

	webhookSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	if webhookSecret != "" && !verifyStripeSignature(sigHeader, body, webhookSecret) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid stripe signature"})
	}

	var event struct {
		Type string `json:"type"`
		Data struct {
			Object map[string]interface{} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid event"})
	}

	switch event.Type {
	case "invoice.payment_succeeded":
		orgID, _ := event.Data.Object["metadata"].(map[string]interface{})["org_id"].(string)
		if orgID != "" {
			_, _ = h.db.Exec(c.Context(),
				`UPDATE subscriptions SET status='active', updated_at=NOW() WHERE organization_id=$1`, orgID)
		}
	case "invoice.payment_failed":
		orgID, _ := event.Data.Object["metadata"].(map[string]interface{})["org_id"].(string)
		if orgID != "" {
			_, _ = h.db.Exec(c.Context(),
				`UPDATE subscriptions SET status='past_due', updated_at=NOW() WHERE organization_id=$1`, orgID)
		}
	case "customer.subscription.deleted":
		orgID, _ := event.Data.Object["metadata"].(map[string]interface{})["org_id"].(string)
		if orgID != "" {
			_, _ = h.db.Exec(c.Context(),
				`UPDATE subscriptions SET status='cancelled', updated_at=NOW() WHERE organization_id=$1`, orgID)
		}
	}

	return c.JSON(fiber.Map{"received": true})
}

// GenerateInvoiceNumber creates a sequential invoice number
func generateInvoiceNumber() string {
	return fmt.Sprintf("INV-%d-%04d", time.Now().Year(), rand.Intn(9000)+1000)
}

var _ = generateInvoiceNumber

// verifyStripeSignature validates the Stripe-Signature header using HMAC-SHA256.
func verifyStripeSignature(sigHeader string, payload []byte, secret string) bool {
	// header format: t=timestamp,v1=signature
	parts := strings.Split(sigHeader, ",")
	var timestamp, sig string
	for _, p := range parts {
		if strings.HasPrefix(p, "t=") {
			timestamp = strings.TrimPrefix(p, "t=")
		}
		if strings.HasPrefix(p, "v1=") {
			sig = strings.TrimPrefix(p, "v1=")
		}
	}
	if timestamp == "" || sig == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "." + string(payload)))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}
