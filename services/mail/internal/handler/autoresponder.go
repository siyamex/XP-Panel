package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

type autoresponder struct {
	ID        string     `json:"id"`
	Email     string     `json:"email"`
	Subject   string     `json:"subject"`
	Body      string     `json:"body"`
	FromName  *string    `json:"from_name"`
	StartAt   *time.Time `json:"start_at"`
	EndAt     *time.Time `json:"end_at"`
	Enabled   bool       `json:"enabled"`
	CreatedAt time.Time  `json:"created_at"`
}

func (h *Handler) ListAutoresponders(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, email, subject, body, from_name, start_at, end_at, enabled, created_at
		 FROM autoresponders WHERE org_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	items := []autoresponder{}
	for rows.Next() {
		var a autoresponder
		if err := rows.Scan(&a.ID, &a.Email, &a.Subject, &a.Body, &a.FromName,
			&a.StartAt, &a.EndAt, &a.Enabled, &a.CreatedAt); err != nil {
			continue
		}
		items = append(items, a)
	}
	return c.JSON(fiber.Map{"autoresponders": items, "total": len(items)})
}

func (h *Handler) CreateAutoresponder(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Email    string     `json:"email"`
		Subject  string     `json:"subject"`
		Body     string     `json:"body"`
		FromName *string    `json:"from_name"`
		StartAt  *time.Time `json:"start_at"`
		EndAt    *time.Time `json:"end_at"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Email == "" || body.Subject == "" || body.Body == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email, subject, body required")
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO autoresponders (org_id, email, subject, body, from_name, start_at, end_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		orgID, body.Email, body.Subject, body.Body, body.FromName, body.StartAt, body.EndAt).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) UpdateAutoresponder(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Subject  string     `json:"subject"`
		Body     string     `json:"body"`
		FromName *string    `json:"from_name"`
		StartAt  *time.Time `json:"start_at"`
		EndAt    *time.Time `json:"end_at"`
		Enabled  *bool      `json:"enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	_, err := h.db.Exec(c.Context(),
		`UPDATE autoresponders SET subject=$1, body=$2, from_name=$3, start_at=$4, end_at=$5,
		 enabled=$6, updated_at=NOW() WHERE id=$7 AND org_id=$8`,
		body.Subject, body.Body, body.FromName, body.StartAt, body.EndAt, enabled, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) DeleteAutoresponder(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM autoresponders WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}
