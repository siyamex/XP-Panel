package handler

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Domain struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	UserID         uuid.UUID  `json:"user_id"`
	Name           string     `json:"name"`
	DocumentRoot   *string    `json:"document_root,omitempty"`
	Status         string     `json:"status"`
	SSLEnabled     bool       `json:"ssl_enabled"`
	WebserverType  string     `json:"webserver_type"`
	PHPVersion     *string    `json:"php_version,omitempty"`
	BandwidthUsedMB int64     `json:"bandwidth_used_mb"`
	DiskUsedMB     int64      `json:"disk_used_mb"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type Handler struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) List(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}

	rows, err := h.db.Query(c.Context(), `
		SELECT id, organization_id, user_id, name, document_root, status,
		       ssl_enabled, webserver_type, php_version,
		       bandwidth_used_mb, disk_used_mb, created_at, updated_at
		FROM domains WHERE organization_id = $1 ORDER BY name`, orgID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	domains := []Domain{}
	for rows.Next() {
		var d Domain
		if err := rows.Scan(&d.ID, &d.OrganizationID, &d.UserID, &d.Name, &d.DocumentRoot,
			&d.Status, &d.SSLEnabled, &d.WebserverType, &d.PHPVersion,
			&d.BandwidthUsedMB, &d.DiskUsedMB, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		domains = append(domains, d)
	}
	return c.JSON(fiber.Map{"domains": domains, "total": len(domains)})
}

func (h *Handler) Get(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var d Domain
	err = h.db.QueryRow(c.Context(), `
		SELECT id, organization_id, user_id, name, document_root, status,
		       ssl_enabled, webserver_type, php_version,
		       bandwidth_used_mb, disk_used_mb, created_at, updated_at
		FROM domains WHERE id = $1 AND organization_id = $2`, id, orgID).
		Scan(&d.ID, &d.OrganizationID, &d.UserID, &d.Name, &d.DocumentRoot,
			&d.Status, &d.SSLEnabled, &d.WebserverType, &d.PHPVersion,
			&d.BandwidthUsedMB, &d.DiskUsedMB, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(d)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	userID, _ := uuid.Parse(c.Get("X-User-ID"))

	var body struct {
		Name          string  `json:"name"`
		WebserverType string  `json:"webserver_type"`
		PHPVersion    *string `json:"php_version"`
		DocumentRoot  *string `json:"document_root"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}

	name := strings.ToLower(strings.TrimSpace(body.Name))
	if name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain name is required")
	}
	if body.WebserverType == "" {
		body.WebserverType = "nginx"
	}
	// Treat empty string php_version as NULL
	if body.PHPVersion != nil && *body.PHPVersion == "" {
		body.PHPVersion = nil
	}

	docRoot := body.DocumentRoot
	if docRoot == nil {
		root := "/var/www/" + name + "/public_html"
		docRoot = &root
	}

	d := Domain{
		ID:            uuid.New(),
		OrganizationID: orgID,
		UserID:        userID,
		Name:          name,
		DocumentRoot:  docRoot,
		Status:        "active",
		SSLEnabled:    false,
		WebserverType: body.WebserverType,
		PHPVersion:    body.PHPVersion,
	}

	_, err = h.db.Exec(c.Context(), `
		INSERT INTO domains (id, organization_id, user_id, name, document_root, status, ssl_enabled, webserver_type, php_version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		d.ID, d.OrganizationID, d.UserID, d.Name, d.DocumentRoot,
		d.Status, d.SSLEnabled, d.WebserverType, d.PHPVersion)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			return fiber.NewError(fiber.StatusConflict, "domain already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	d.CreatedAt = time.Now()
	d.UpdatedAt = time.Now()
	return c.Status(fiber.StatusCreated).JSON(d)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	ct, err := h.db.Exec(c.Context(), `DELETE FROM domains WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if ct.RowsAffected() == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) Suspend(c *fiber.Ctx) error {
	return h.setStatus(c, "suspended")
}

func (h *Handler) Unsuspend(c *fiber.Ctx) error {
	return h.setStatus(c, "active")
}

func (h *Handler) setStatus(c *fiber.Ctx, status string) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var d Domain
	err = h.db.QueryRow(c.Context(), `
		UPDATE domains SET status = $1, updated_at = NOW()
		WHERE id = $2 AND organization_id = $3
		RETURNING id, organization_id, user_id, name, document_root, status,
		          ssl_enabled, webserver_type, php_version,
		          bandwidth_used_mb, disk_used_mb, created_at, updated_at`,
		status, id, orgID).
		Scan(&d.ID, &d.OrganizationID, &d.UserID, &d.Name, &d.DocumentRoot,
			&d.Status, &d.SSLEnabled, &d.WebserverType, &d.PHPVersion,
			&d.BandwidthUsedMB, &d.DiskUsedMB, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(d)
}

func errorCtx(ctx context.Context) context.Context { return ctx }
var _ = errorCtx
