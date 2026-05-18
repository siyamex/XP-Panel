package domain

import "time"

type BackupStatus string
type BackupType string

const (
	StatusPending   BackupStatus = "pending"
	StatusRunning   BackupStatus = "running"
	StatusCompleted BackupStatus = "completed"
	StatusFailed    BackupStatus = "failed"

	TypeFull        BackupType = "full"
	TypeIncremental BackupType = "incremental"
	TypeDatabase    BackupType = "database"
	TypeFiles       BackupType = "files"
)

type Backup struct {
	ID             string       `json:"id"`
	OrganizationID string       `json:"organization_id"`
	ScheduleID     *string      `json:"schedule_id"`
	DestinationID  *string      `json:"destination_id"`
	Name           string       `json:"name"`
	Type           BackupType   `json:"type"`
	Status         BackupStatus `json:"status"`
	SizeBytes      int64        `json:"size_bytes"`
	StoragePath    *string      `json:"storage_path"`
	Encrypted      bool         `json:"encrypted"`
	ErrorMessage   *string      `json:"error_message,omitempty"`
	StartedAt      *time.Time   `json:"started_at"`
	CompletedAt    *time.Time   `json:"completed_at"`
	CreatedAt      time.Time    `json:"created_at"`
}

type BackupSchedule struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	Name           string     `json:"name"`
	CronExpr       string     `json:"cron_expr"`
	DestinationID  *string    `json:"destination_id"`
	Type           BackupType `json:"type"`
	RetainCount    int        `json:"retain_count"`
	Enabled        bool       `json:"enabled"`
	LastRunAt      *time.Time `json:"last_run_at"`
	NextRunAt      *time.Time `json:"next_run_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type BackupDestination struct {
	ID             string         `json:"id"`
	OrganizationID string         `json:"organization_id"`
	Name           string         `json:"name"`
	Type           string         `json:"type"`
	Config         map[string]any `json:"config"`
	CreatedAt      time.Time      `json:"created_at"`
}

type CreateBackupRequest struct {
	Name          string     `json:"name"`
	Type          BackupType `json:"type"`
	DestinationID *string    `json:"destination_id"`
}

type CreateScheduleRequest struct {
	Name          string     `json:"name" validate:"required"`
	CronExpr      string     `json:"cron_expr" validate:"required"`
	Type          BackupType `json:"type"`
	DestinationID *string    `json:"destination_id"`
	RetainCount   int        `json:"retain_count"`
}

type CreateDestinationRequest struct {
	Name   string         `json:"name" validate:"required"`
	Type   string         `json:"type" validate:"required"`
	Config map[string]any `json:"config"`
}
