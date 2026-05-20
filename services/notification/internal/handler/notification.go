package handler

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/notification/internal/domain"
)

type NotificationHandler struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *NotificationHandler {
	return &NotificationHandler{db: db}
}

func (h *NotificationHandler) List(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	userID := c.Get("X-User-ID", "")
	unreadOnly := c.QueryBool("unread")

	query := `SELECT id, organization_id, user_id, type, title, message, link, read, read_at, created_at
	          FROM notifications WHERE organization_id=$1`
	args := []any{orgID}
	n := 2

	if userID != "" {
		query += ` AND (user_id=$2 OR user_id IS NULL)`
		args = append(args, userID)
		n++
	}
	if unreadOnly {
		query += ` AND read=FALSE`
	}
	_ = n
	query += ` ORDER BY created_at DESC LIMIT 100`

	rows, err := h.db.Query(c.Context(), query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	notifications := []domain.Notification{}
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(&n.ID, &n.OrganizationID, &n.UserID, &n.Type, &n.Title,
			&n.Message, &n.Link, &n.Read, &n.ReadAt, &n.CreatedAt); err != nil {
			continue
		}
		notifications = append(notifications, n)
	}
	return c.JSON(fiber.Map{"notifications": notifications, "total": len(notifications)})
}

func (h *NotificationHandler) UnreadCount(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var count int
	err := h.db.QueryRow(c.Context(),
		`SELECT COUNT(*) FROM notifications WHERE organization_id=$1 AND read=FALSE`, orgID,
	).Scan(&count)
	if err != nil {
		count = 0
	}
	return c.JSON(fiber.Map{"count": count})
}

func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")
	now := time.Now()
	ct, err := h.db.Exec(c.Context(),
		`UPDATE notifications SET read=TRUE, read_at=$1 WHERE id=$2 AND organization_id=$3`,
		now, id, orgID)
	if err != nil || ct.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "notification not found"})
	}
	return c.JSON(fiber.Map{"read": true})
}

func (h *NotificationHandler) MarkAllRead(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	now := time.Now()
	ct, err := h.db.Exec(c.Context(),
		`UPDATE notifications SET read=TRUE, read_at=$1 WHERE organization_id=$2 AND read=FALSE`,
		now, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"updated": ct.RowsAffected()})
}

func (h *NotificationHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")
	h.db.Exec(c.Context(), `DELETE FROM notifications WHERE id=$1 AND organization_id=$2`, id, orgID)
	return c.SendStatus(204)
}

func (h *NotificationHandler) GetPreferences(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	userID := c.Get("X-User-ID", "default")

	var prefs domain.NotificationPreferences
	err := h.db.QueryRow(c.Context(),
		`SELECT id, organization_id, user_id, email_enabled, slack_enabled,
		        COALESCE(slack_webhook,''), COALESCE(telegram_chat_id,''),
		        alerts_enabled, backups_enabled, security_enabled, billing_enabled
		 FROM notification_preferences WHERE organization_id=$1 AND user_id=$2`,
		orgID, userID,
	).Scan(&prefs.ID, &prefs.OrganizationID, &prefs.UserID, &prefs.EmailEnabled,
		&prefs.SlackEnabled, &prefs.SlackWebhook, &prefs.TelegramChatID,
		&prefs.AlertsEnabled, &prefs.BackupsEnabled, &prefs.SecurityEnabled, &prefs.BillingEnabled)
	if err != nil {
		// Return sensible defaults when no row exists yet
		prefs = domain.NotificationPreferences{
			OrganizationID:  orgID,
			UserID:          userID,
			EmailEnabled:    true,
			AlertsEnabled:   true,
			BackupsEnabled:  true,
			SecurityEnabled: true,
			BillingEnabled:  true,
		}
	}
	return c.JSON(prefs)
}

func (h *NotificationHandler) UpdatePreferences(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	userID := c.Get("X-User-ID", "default")

	var req domain.NotificationPreferences
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	prefsJSON, _ := json.Marshal(req)
	_ = prefsJSON

	_, err := h.db.Exec(c.Context(),
		`INSERT INTO notification_preferences
		   (organization_id, user_id, email_enabled, slack_enabled, slack_webhook, telegram_chat_id,
		    alerts_enabled, backups_enabled, security_enabled, billing_enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 ON CONFLICT (organization_id, user_id) DO UPDATE SET
		   email_enabled=$3, slack_enabled=$4, slack_webhook=$5, telegram_chat_id=$6,
		   alerts_enabled=$7, backups_enabled=$8, security_enabled=$9, billing_enabled=$10,
		   updated_at=NOW()`,
		orgID, userID, req.EmailEnabled, req.SlackEnabled,
		nullStr(req.SlackWebhook), nullStr(req.TelegramChatID),
		req.AlertsEnabled, req.BackupsEnabled, req.SecurityEnabled, req.BillingEnabled,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"updated": true})
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
