package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Alias struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Source         string    `json:"source"`
	Destination    string    `json:"destination"`
	CatchAll       bool      `json:"catch_all"`
	Active         bool      `json:"active"`
	CreatedAt      time.Time `json:"created_at"`
}

// GET /mail/aliases?domain=example.com
func (h *Handler) ListAliases(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	domain := c.Query("domain")

	query := `SELECT id, organization_id, source, destination, catch_all, active, created_at
	          FROM email_aliases WHERE organization_id=$1`
	args := []any{orgID}
	if domain != "" {
		query += ` AND source LIKE $2`
		args = append(args, "%@"+domain)
	}
	query += ` ORDER BY catch_all DESC, source`

	rows, err := h.db.Query(c.Context(), query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	aliases := []Alias{}
	for rows.Next() {
		var a Alias
		if err := rows.Scan(&a.ID, &a.OrganizationID, &a.Source, &a.Destination, &a.CatchAll, &a.Active, &a.CreatedAt); err != nil {
			continue
		}
		aliases = append(aliases, a)
	}
	return c.JSON(fiber.Map{"aliases": aliases, "total": len(aliases)})
}

// POST /mail/aliases
func (h *Handler) CreateAlias(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))

	var req struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
		CatchAll    bool   `json:"catch_all"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Source == "" || req.Destination == "" {
		return c.Status(400).JSON(fiber.Map{"error": "source and destination are required"})
	}

	// Catch-all uses @domain format
	if req.CatchAll {
		req.Source = "@" + req.Source // source should be domain name only for catch-all
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO email_aliases (organization_id, source, destination, catch_all, active)
		 VALUES ($1,$2,$3,$4,TRUE) RETURNING id`,
		orgID, req.Source, req.Destination, req.CatchAll,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"id": id})
}

// DELETE /mail/aliases/:id
func (h *Handler) DeleteAlias(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id := c.Params("id")
	h.db.Exec(c.Context(), `DELETE FROM email_aliases WHERE id=$1 AND organization_id=$2`, id, orgID)
	return c.SendStatus(204)
}

// GET /mail/dmarc?domain=example.com — generate DMARC policy
func (h *Handler) GetDMARC(c *fiber.Ctx) error {
	domain := c.Query("domain")
	if domain == "" {
		return c.Status(400).JSON(fiber.Map{"error": "domain is required"})
	}

	// Sensible DMARC default
	policy := c.Query("policy", "none")
	pct := c.Query("pct", "100")
	rua := c.Query("rua", "mailto:dmarc@"+domain)

	record := "v=DMARC1; p=" + policy + "; pct=" + pct + "; rua=" + rua + ";"

	return c.JSON(fiber.Map{
		"domain":     domain,
		"record":     record,
		"dns_name":   "_dmarc." + domain,
		"dns_type":   "TXT",
		"dns_value":  record,
		"policy":     policy,
		"guidelines": dmarcGuidelines(policy),
	})
}

func dmarcGuidelines(policy string) string {
	switch policy {
	case "reject":
		return "Strictest policy. Emails that fail DMARC checks will be rejected."
	case "quarantine":
		return "Emails that fail DMARC will be sent to spam/quarantine."
	default:
		return "Monitor only. No action taken on failed emails. Recommended for initial setup."
	}
}
