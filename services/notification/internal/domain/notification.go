package domain

import "time"

type Notification struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	UserID         *string    `json:"user_id"`
	Type           string     `json:"type"`
	Title          string     `json:"title"`
	Message        string     `json:"message"`
	Link           *string    `json:"link"`
	Read           bool       `json:"read"`
	ReadAt         *time.Time `json:"read_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type NotificationPreferences struct {
	ID               string `json:"id"`
	OrganizationID   string `json:"organization_id"`
	UserID           string `json:"user_id"`
	EmailEnabled     bool   `json:"email_enabled"`
	SlackEnabled     bool   `json:"slack_enabled"`
	SlackWebhook     string `json:"slack_webhook,omitempty"`
	TelegramChatID   string `json:"telegram_chat_id,omitempty"`
	DiscordEnabled   bool   `json:"discord_enabled"`
	DiscordWebhook   string `json:"discord_webhook,omitempty"`
	WebhookEnabled   bool   `json:"webhook_enabled"`
	WebhookURL       string `json:"webhook_url,omitempty"`
	WebhookSecret    string `json:"webhook_secret,omitempty"`
	AlertsEnabled    bool   `json:"alerts_enabled"`
	BackupsEnabled   bool   `json:"backups_enabled"`
	SecurityEnabled  bool   `json:"security_enabled"`
	BillingEnabled   bool   `json:"billing_enabled"`
}
