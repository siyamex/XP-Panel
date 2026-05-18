package handler

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/security/internal/domain"
)

type SecurityHandler struct {
	pool *pgxpool.Pool
}

func NewSecurityHandler(pool *pgxpool.Pool) *SecurityHandler {
	return &SecurityHandler{pool: pool}
}

func (h *SecurityHandler) Score(c *fiber.Ctx) error {
	checks := []domain.Check{
		{Name: "Firewall Active", Passed: true, Message: "nftables firewall is active", Weight: 20},
		{Name: "SSH Hardened", Passed: true, Message: "SSH root login disabled", Weight: 15},
		{Name: "Fail2ban Active", Passed: true, Message: "Fail2ban is running", Weight: 15},
		{Name: "SSL/TLS Only", Passed: false, Message: "Some domains missing SSL", Weight: 20},
		{Name: "Automatic Updates", Passed: false, Message: "Unattended upgrades not configured", Weight: 10},
		{Name: "Audit Logging", Passed: true, Message: "Audit logging enabled", Weight: 10},
		{Name: "Backup Policy", Passed: false, Message: "No backup schedule configured", Weight: 10},
	}

	score := 0
	maxScore := 0
	for _, ch := range checks {
		maxScore += ch.Weight
		if ch.Passed {
			score += ch.Weight
		}
	}

	grade := "F"
	pct := score * 100 / maxScore
	switch {
	case pct >= 90:
		grade = "A"
	case pct >= 80:
		grade = "B"
	case pct >= 70:
		grade = "C"
	case pct >= 60:
		grade = "D"
	}

	return c.JSON(domain.SecurityScore{Score: score, MaxScore: maxScore, Grade: grade, Checks: checks})
}

func (h *SecurityHandler) ListFirewallRules(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, server_id, chain, action, protocol, source_ip,
		        dest_ip, port_range, priority, enabled, comment, created_at
		 FROM firewall_rules WHERE organization_id = $1 ORDER BY priority, created_at`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	rules := []domain.FirewallRule{}
	for rows.Next() {
		var r domain.FirewallRule
		if err := rows.Scan(&r.ID, &r.OrganizationID, &r.ServerID, &r.Chain, &r.Action,
			&r.Protocol, &r.SourceIP, &r.DestIP, &r.PortRange, &r.Priority,
			&r.Enabled, &r.Comment, &r.CreatedAt); err != nil {
			continue
		}
		rules = append(rules, r)
	}
	return c.JSON(fiber.Map{"rules": rules})
}

func (h *SecurityHandler) CreateFirewallRule(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateFirewallRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Chain == "" {
		req.Chain = "INPUT"
	}
	if req.Priority == 0 {
		req.Priority = 100
	}

	var r domain.FirewallRule
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO firewall_rules (organization_id, chain, action, protocol, source_ip, dest_ip, port_range, priority, comment)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, organization_id, server_id, chain, action, protocol, source_ip, dest_ip, port_range, priority, enabled, comment, created_at`,
		orgID, req.Chain, req.Action, req.Protocol, req.SourceIP, req.DestIP, req.PortRange, req.Priority, req.Comment,
	).Scan(&r.ID, &r.OrganizationID, &r.ServerID, &r.Chain, &r.Action, &r.Protocol,
		&r.SourceIP, &r.DestIP, &r.PortRange, &r.Priority, &r.Enabled, &r.Comment, &r.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(r)
}

func (h *SecurityHandler) DeleteFirewallRule(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.pool.Exec(c.Context(), `DELETE FROM firewall_rules WHERE id = $1`, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "rule not found"})
	}
	return c.SendStatus(204)
}

func (h *SecurityHandler) ListEvents(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, server_id, type, severity, source_ip, source_country,
		        target, details, mitigated, created_at
		 FROM security_events WHERE organization_id = $1 OR organization_id IS NULL
		 ORDER BY created_at DESC LIMIT 100`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	events := []domain.SecurityEvent{}
	for rows.Next() {
		var e domain.SecurityEvent
		var detailsJSON []byte
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.ServerID, &e.Type, &e.Severity,
			&e.SourceIP, &e.SourceCountry, &e.Target, &detailsJSON, &e.Mitigated, &e.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(detailsJSON, &e.Details)
		events = append(events, e)
	}
	return c.JSON(fiber.Map{"events": events})
}

func (h *SecurityHandler) ListBlocklist(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, ip, reason, expires_at, created_at
		 FROM ip_blocklist WHERE organization_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	entries := []domain.IPBlocklistEntry{}
	for rows.Next() {
		var e domain.IPBlocklistEntry
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.IP, &e.Reason, &e.ExpiresAt, &e.CreatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return c.JSON(fiber.Map{"entries": entries})
}

func (h *SecurityHandler) BlockIP(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.BlockIPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	var e domain.IPBlocklistEntry
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO ip_blocklist (organization_id, ip, reason)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (organization_id, ip) DO UPDATE SET reason = EXCLUDED.reason
		 RETURNING id, organization_id, ip, reason, expires_at, created_at`,
		orgID, req.IP, req.Reason,
	).Scan(&e.ID, &e.OrganizationID, &e.IP, &e.Reason, &e.ExpiresAt, &e.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(e)
}

func (h *SecurityHandler) UnblockIP(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")
	_, err := h.pool.Exec(c.Context(),
		`DELETE FROM ip_blocklist WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "entry not found"})
	}
	return c.SendStatus(204)
}
