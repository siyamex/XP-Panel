package domain

import "time"

type ServerMetrics struct {
	ServerID    string    `json:"server_id"`
	Timestamp   time.Time `json:"timestamp"`
	CPUPercent  float64   `json:"cpu_percent"`
	RAMPercent  float64   `json:"ram_percent"`
	DiskPercent float64   `json:"disk_percent"`
	NetInMBs    float64   `json:"net_in_mb_s"`
	NetOutMBs   float64   `json:"net_out_mb_s"`
	LoadAvg1    float64   `json:"load_avg_1"`
	LoadAvg5    float64   `json:"load_avg_5"`
	LoadAvg15   float64   `json:"load_avg_15"`
	Processes   uint64    `json:"processes"`
	RAMTotalMB  uint64    `json:"ram_total_mb"`
	RAMUsedMB   uint64    `json:"ram_used_mb"`
	DiskTotalMB uint64    `json:"disk_total_mb"`
	DiskUsedMB  uint64    `json:"disk_used_mb"`
	Uptime      uint64    `json:"uptime"`
}

type AlertRule struct {
	ID              string    `json:"id"`
	OrganizationID  string    `json:"organization_id"`
	ServerID        *string   `json:"server_id"`
	Name            string    `json:"name"`
	Metric          string    `json:"metric"`
	Condition       string    `json:"condition"`
	Threshold       float64   `json:"threshold"`
	DurationSeconds int       `json:"duration_seconds"`
	Severity        string    `json:"severity"`
	Channels        []string  `json:"channels"`
	Enabled         bool      `json:"enabled"`
	CreatedAt       time.Time `json:"created_at"`
}

type Incident struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	AlertRuleID    *string    `json:"alert_rule_id"`
	ServerID       *string    `json:"server_id"`
	Title          string     `json:"title"`
	Status         string     `json:"status"`
	Severity       string     `json:"severity"`
	Metric         *string    `json:"metric"`
	Value          *float64   `json:"value"`
	Threshold      *float64   `json:"threshold"`
	StartedAt      time.Time  `json:"started_at"`
	ResolvedAt     *time.Time `json:"resolved_at"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
}

type CreateAlertRuleRequest struct {
	ServerID        *string  `json:"server_id"`
	Name            string   `json:"name" validate:"required"`
	Metric          string   `json:"metric" validate:"required"`
	Condition       string   `json:"condition" validate:"required"`
	Threshold       float64  `json:"threshold" validate:"required"`
	DurationSeconds int      `json:"duration_seconds"`
	Severity        string   `json:"severity"`
	Channels        []string `json:"channels"`
}
