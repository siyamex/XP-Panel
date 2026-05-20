package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type cronJob struct {
	ID         string     `json:"id"`
	OrgID      string     `json:"org_id"`
	UserID     string     `json:"user_id"`
	Domain     *string    `json:"domain"`
	Label      string     `json:"label"`
	Command    string     `json:"command"`
	Schedule   string     `json:"schedule"`
	Minute     string     `json:"minute"`
	Hour       string     `json:"hour"`
	DayMonth   string     `json:"day_month"`
	Month      string     `json:"month"`
	DayWeek    string     `json:"day_week"`
	Enabled    bool       `json:"enabled"`
	LastRunAt  *time.Time `json:"last_run_at"`
	LastStatus *string    `json:"last_status"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (h *Handler) ListCronJobs(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, org_id, user_id, domain, label, command, schedule,
		        minute, hour, day_month, month, day_week, enabled,
		        last_run_at, last_status, created_at
		 FROM cron_jobs WHERE org_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	jobs := []cronJob{}
	for rows.Next() {
		var j cronJob
		if err := rows.Scan(&j.ID, &j.OrgID, &j.UserID, &j.Domain, &j.Label, &j.Command,
			&j.Schedule, &j.Minute, &j.Hour, &j.DayMonth, &j.Month, &j.DayWeek,
			&j.Enabled, &j.LastRunAt, &j.LastStatus, &j.CreatedAt); err != nil {
			continue
		}
		jobs = append(jobs, j)
	}
	return c.JSON(fiber.Map{"jobs": jobs, "total": len(jobs)})
}

func (h *Handler) CreateCronJob(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", uuid.New().String())
	userID := c.Get("X-User-ID", uuid.New().String())

	var body struct {
		Domain   *string `json:"domain"`
		Label    string  `json:"label"`
		Command  string  `json:"command"`
		Minute   string  `json:"minute"`
		Hour     string  `json:"hour"`
		DayMonth string  `json:"day_month"`
		Month    string  `json:"month"`
		DayWeek  string  `json:"day_week"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Label == "" || body.Command == "" {
		return fiber.NewError(fiber.StatusBadRequest, "label and command required")
	}
	if body.Minute == "" {
		body.Minute = "*"
	}
	if body.Hour == "" {
		body.Hour = "*"
	}
	if body.DayMonth == "" {
		body.DayMonth = "*"
	}
	if body.Month == "" {
		body.Month = "*"
	}
	if body.DayWeek == "" {
		body.DayWeek = "*"
	}
	schedule := body.Minute + " " + body.Hour + " " + body.DayMonth + " " + body.Month + " " + body.DayWeek

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO cron_jobs (org_id, user_id, domain, label, command, schedule, minute, hour, day_month, month, day_week)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
		orgID, userID, body.Domain, body.Label, body.Command, schedule,
		body.Minute, body.Hour, body.DayMonth, body.Month, body.DayWeek).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) UpdateCronJob(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")

	var body struct {
		Label    string  `json:"label"`
		Command  string  `json:"command"`
		Minute   string  `json:"minute"`
		Hour     string  `json:"hour"`
		DayMonth string  `json:"day_month"`
		Month    string  `json:"month"`
		DayWeek  string  `json:"day_week"`
		Enabled  *bool   `json:"enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	schedule := body.Minute + " " + body.Hour + " " + body.DayMonth + " " + body.Month + " " + body.DayWeek

	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	_, err := h.db.Exec(c.Context(),
		`UPDATE cron_jobs SET label=$1, command=$2, schedule=$3, minute=$4, hour=$5,
		 day_month=$6, month=$7, day_week=$8, enabled=$9, updated_at=NOW()
		 WHERE id=$10 AND org_id=$11`,
		body.Label, body.Command, schedule, body.Minute, body.Hour,
		body.DayMonth, body.Month, body.DayWeek, enabled, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) DeleteCronJob(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM cron_jobs WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) ToggleCronJob(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(),
		`UPDATE cron_jobs SET enabled = NOT enabled, updated_at=NOW() WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}
