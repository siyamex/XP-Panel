package handler

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
)

type emailFilter struct {
	ID          string          `json:"id"`
	Mailbox     string          `json:"mailbox"`
	Name        string          `json:"name"`
	Rules       json.RawMessage `json:"rules"`
	Action      string          `json:"action"`
	ActionValue *string         `json:"action_value"`
	Priority    int             `json:"priority"`
	Enabled     bool            `json:"enabled"`
	CreatedAt   time.Time       `json:"created_at"`
}

func (h *Handler) ListEmailFilters(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	mailbox := c.Query("mailbox")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, mailbox, name, rules, action, action_value, priority, enabled, created_at
		 FROM email_filters WHERE org_id=$1 AND mailbox=$2 ORDER BY priority ASC`, orgID, mailbox)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	items := []emailFilter{}
	for rows.Next() {
		var f emailFilter
		var rulesStr []byte
		if err := rows.Scan(&f.ID, &f.Mailbox, &f.Name, &rulesStr, &f.Action,
			&f.ActionValue, &f.Priority, &f.Enabled, &f.CreatedAt); err != nil {
			continue
		}
		f.Rules = rulesStr
		items = append(items, f)
	}
	return c.JSON(fiber.Map{"filters": items, "total": len(items)})
}

func (h *Handler) CreateEmailFilter(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Mailbox     string          `json:"mailbox"`
		Name        string          `json:"name"`
		Rules       json.RawMessage `json:"rules"`
		Action      string          `json:"action"`
		ActionValue *string         `json:"action_value"`
		Priority    int             `json:"priority"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Mailbox == "" || body.Name == "" || body.Action == "" {
		return fiber.NewError(fiber.StatusBadRequest, "mailbox, name, action required")
	}
	if body.Rules == nil {
		body.Rules = json.RawMessage("[]")
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO email_filters (org_id, mailbox, name, rules, action, action_value, priority)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		orgID, body.Mailbox, body.Name, body.Rules, body.Action, body.ActionValue, body.Priority).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) UpdateEmailFilter(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Name        string          `json:"name"`
		Rules       json.RawMessage `json:"rules"`
		Action      string          `json:"action"`
		ActionValue *string         `json:"action_value"`
		Priority    int             `json:"priority"`
		Enabled     *bool           `json:"enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	_, err := h.db.Exec(c.Context(),
		`UPDATE email_filters SET name=$1, rules=$2, action=$3, action_value=$4, priority=$5, enabled=$6
		 WHERE id=$7 AND org_id=$8`,
		body.Name, body.Rules, body.Action, body.ActionValue, body.Priority, enabled, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) DeleteEmailFilter(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM email_filters WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}
