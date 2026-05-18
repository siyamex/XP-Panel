package handler

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/monitoring/internal/collector"
	"github.com/xpanel/monitoring/internal/domain"
)

type MetricsHandler struct {
	pool *pgxpool.Pool
}

func NewMetricsHandler(pool *pgxpool.Pool) *MetricsHandler {
	return &MetricsHandler{pool: pool}
}

func (h *MetricsHandler) Current(c *fiber.Ctx) error {
	serverID := c.Query("server_id", "local")
	metrics, err := collector.Collect(serverID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(metrics)
}

func (h *MetricsHandler) ListAlertRules(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, server_id, name, metric, condition, threshold,
		        duration_seconds, severity, channels, enabled, created_at
		 FROM alert_rules WHERE organization_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	rules := []domain.AlertRule{}
	for rows.Next() {
		var r domain.AlertRule
		var channelsJSON []byte
		if err := rows.Scan(&r.ID, &r.OrganizationID, &r.ServerID, &r.Name, &r.Metric,
			&r.Condition, &r.Threshold, &r.DurationSeconds, &r.Severity,
			&channelsJSON, &r.Enabled, &r.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(channelsJSON, &r.Channels)
		rules = append(rules, r)
	}
	return c.JSON(fiber.Map{"rules": rules})
}

func (h *MetricsHandler) CreateAlertRule(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateAlertRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.DurationSeconds <= 0 {
		req.DurationSeconds = 60
	}
	if req.Severity == "" {
		req.Severity = "warning"
	}
	if req.Channels == nil {
		req.Channels = []string{}
	}

	channelsJSON, _ := json.Marshal(req.Channels)

	var r domain.AlertRule
	var rawChannels []byte
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO alert_rules (organization_id, server_id, name, metric, condition, threshold,
		         duration_seconds, severity, channels)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, organization_id, server_id, name, metric, condition, threshold,
		           duration_seconds, severity, channels, enabled, created_at`,
		orgID, req.ServerID, req.Name, req.Metric, req.Condition, req.Threshold,
		req.DurationSeconds, req.Severity, channelsJSON,
	).Scan(&r.ID, &r.OrganizationID, &r.ServerID, &r.Name, &r.Metric, &r.Condition,
		&r.Threshold, &r.DurationSeconds, &r.Severity, &rawChannels, &r.Enabled, &r.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	_ = json.Unmarshal(rawChannels, &r.Channels)
	return c.Status(201).JSON(r)
}

func (h *MetricsHandler) DeleteAlertRule(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.pool.Exec(c.Context(), `DELETE FROM alert_rules WHERE id = $1`, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "rule not found"})
	}
	return c.SendStatus(204)
}

func (h *MetricsHandler) ListIncidents(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, alert_rule_id, server_id, title, status, severity,
		        metric, value, threshold, started_at, resolved_at, acknowledged_at
		 FROM incidents WHERE organization_id = $1 ORDER BY started_at DESC LIMIT 50`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	incidents := []domain.Incident{}
	for rows.Next() {
		var i domain.Incident
		if err := rows.Scan(&i.ID, &i.OrganizationID, &i.AlertRuleID, &i.ServerID,
			&i.Title, &i.Status, &i.Severity, &i.Metric, &i.Value, &i.Threshold,
			&i.StartedAt, &i.ResolvedAt, &i.AcknowledgedAt); err != nil {
			continue
		}
		incidents = append(incidents, i)
	}
	return c.JSON(fiber.Map{"incidents": incidents})
}
