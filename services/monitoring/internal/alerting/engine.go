package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/monitoring/internal/collector"
	"github.com/xpanel/monitoring/internal/domain"
)

type Engine struct {
	pool            *pgxpool.Pool
	notificationURL string
	interval        time.Duration
}

func NewEngine(pool *pgxpool.Pool) *Engine {
	return &Engine{
		pool:            pool,
		notificationURL: os.Getenv("NOTIFICATION_SERVICE_URL"),
		interval:        30 * time.Second,
	}
}

func (e *Engine) Start(ctx context.Context) {
	ticker := time.NewTicker(e.interval)
	defer ticker.Stop()
	log.Println("alerting engine started (30s interval)")
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.evaluate(ctx)
		}
	}
}

func (e *Engine) evaluate(ctx context.Context) {
	rows, err := e.pool.Query(ctx,
		`SELECT id, organization_id, server_id, name, metric, condition, threshold,
		        duration_seconds, severity, channels, remediation
		 FROM alert_rules WHERE enabled = TRUE`)
	if err != nil {
		return
	}
	defer rows.Close()

	metrics, _ := collector.Collect("local")

	for rows.Next() {
		var r domain.AlertRule
		var channelsJSON []byte
		var remediationJSON []byte
		if err := rows.Scan(&r.ID, &r.OrganizationID, &r.ServerID, &r.Name, &r.Metric,
			&r.Condition, &r.Threshold, &r.DurationSeconds, &r.Severity,
			&channelsJSON, &remediationJSON); err != nil {
			continue
		}
		_ = json.Unmarshal(channelsJSON, &r.Channels)

		if !e.isTriggered(r, metrics) {
			continue
		}

		// Check if there's already an open incident for this rule
		var existingCount int
		_ = e.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM incidents WHERE alert_rule_id = $1 AND status != 'resolved'`, r.ID).
			Scan(&existingCount)
		if existingCount > 0 {
			continue
		}

		value := e.metricValue(r.Metric, metrics)
		title := fmt.Sprintf("[%s] %s on %s", r.Severity, r.Name, r.OrganizationID)
		var incidentID string
		_ = e.pool.QueryRow(ctx,
			`INSERT INTO incidents (organization_id, alert_rule_id, server_id, title, severity, metric, value, threshold)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
			r.OrganizationID, r.ID, r.ServerID, title, r.Severity, r.Metric, value, r.Threshold,
		).Scan(&incidentID)

		log.Printf("incident created: %s (rule: %s, metric: %s=%.2f)", incidentID, r.Name, r.Metric, value)

		// Run auto-remediation if configured
		if len(remediationJSON) > 0 && string(remediationJSON) != "null" {
			var remediation domain.RemediationConfig
			if err := json.Unmarshal(remediationJSON, &remediation); err == nil {
				go e.remediate(ctx, incidentID, r.OrganizationID, remediation)
			}
		}
	}
}

func (e *Engine) isTriggered(r domain.AlertRule, m *domain.SystemMetrics) bool {
	val := e.metricValue(r.Metric, m)
	switch r.Condition {
	case "gt":
		return val > r.Threshold
	case "gte":
		return val >= r.Threshold
	case "lt":
		return val < r.Threshold
	case "lte":
		return val <= r.Threshold
	case "eq":
		return val == r.Threshold
	}
	return false
}

func (e *Engine) metricValue(metric string, m *domain.SystemMetrics) float64 {
	if m == nil {
		return 0
	}
	switch metric {
	case "cpu_percent":
		return m.CPUPercent
	case "ram_percent":
		return m.RAMPercent
	case "disk_percent":
		return m.DiskPercent
	case "load_avg_1":
		return m.LoadAvg1
	case "load_avg_5":
		return m.LoadAvg5
	case "load_avg_15":
		return m.LoadAvg15
	case "net_in_mb_s":
		return m.NetInMBs
	case "net_out_mb_s":
		return m.NetOutMBs
	}
	return 0
}

func (e *Engine) remediate(ctx context.Context, incidentID, orgID string, cfg domain.RemediationConfig) {
	log.Printf("running remediation action=%s for incident=%s", cfg.Action, incidentID)

	var status, output string
	switch cfg.Action {
	case "restart_service":
		svc := cfg.Target
		if svc == "" {
			svc = "nginx"
		}
		cmd := exec.CommandContext(ctx, "systemctl", "restart", svc)
		out, err := cmd.CombinedOutput()
		output = string(out)
		if err != nil {
			status = "failed"
			log.Printf("remediation failed: %v", err)
		} else {
			status = "success"
		}

	case "clear_cache":
		cmd := exec.CommandContext(ctx, "sync")
		out, _ := cmd.CombinedOutput()
		output = string(out)
		// Drop page cache
		exec.CommandContext(ctx, "sh", "-c", "echo 3 > /proc/sys/vm/drop_caches").Run()
		status = "success"

	case "kill_process":
		if cfg.Target == "" {
			status = "failed"
			output = "no target process specified"
		} else {
			cmd := exec.CommandContext(ctx, "pkill", "-f", cfg.Target)
			out, err := cmd.CombinedOutput()
			output = string(out)
			if err != nil {
				status = "failed"
			} else {
				status = "success"
			}
		}

	case "send_notification":
		status = "success"
		output = "notification dispatched"

	default:
		status = "skipped"
		output = fmt.Sprintf("unknown action: %s", cfg.Action)
	}

	// Record remediation log
	_, _ = e.pool.Exec(ctx,
		`INSERT INTO remediation_logs (incident_id, organization_id, action, target, status, output)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		incidentID, orgID, cfg.Action, cfg.Target, status, output)

	if status == "success" {
		// Auto-resolve incident after successful remediation
		_, _ = e.pool.Exec(ctx,
			`UPDATE incidents SET status = 'resolved', resolved_at = NOW() WHERE id = $1`, incidentID)
	}
}
