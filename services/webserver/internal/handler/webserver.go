package handler

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }
func New(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

type Vhost struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	DomainName     string     `json:"domain_name"`
	ServerType     string     `json:"server_type"`
	DocumentRoot   string     `json:"document_root"`
	PHPVersion     *string    `json:"php_version"`
	SSLEnabled     bool       `json:"ssl_enabled"`
	SSLCertPath    *string    `json:"ssl_cert_path,omitempty"`
	SSLKeyPath     *string    `json:"ssl_key_path,omitempty"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type SSLCert struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	Domain         string     `json:"domain"`
	Provider       string     `json:"provider"`
	Status         string     `json:"status"`
	ExpiresAt      *time.Time `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

func (h *Handler) ListVhosts(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	rows, err := h.db.Query(c.Context(),
		`SELECT id, organization_id, domain_name, server_type, document_root,
		        php_version, ssl_enabled, ssl_cert_path, ssl_key_path, status, created_at, updated_at
		 FROM vhosts WHERE organization_id=$1 ORDER BY domain_name`, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	defer rows.Close()
	list := []Vhost{}
	for rows.Next() {
		var v Vhost
		if err := rows.Scan(&v.ID, &v.OrganizationID, &v.DomainName, &v.ServerType, &v.DocumentRoot,
			&v.PHPVersion, &v.SSLEnabled, &v.SSLCertPath, &v.SSLKeyPath, &v.Status, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return fiber.NewError(500, err.Error())
		}
		list = append(list, v)
	}
	return c.JSON(fiber.Map{"vhosts": list, "total": len(list)})
}

func (h *Handler) GetVhost(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	var v Vhost
	err = h.db.QueryRow(c.Context(),
		`SELECT id, organization_id, domain_name, server_type, document_root,
		        php_version, ssl_enabled, ssl_cert_path, ssl_key_path, status, created_at, updated_at
		 FROM vhosts WHERE id=$1 AND organization_id=$2`, id, orgID).
		Scan(&v.ID, &v.OrganizationID, &v.DomainName, &v.ServerType, &v.DocumentRoot,
			&v.PHPVersion, &v.SSLEnabled, &v.SSLCertPath, &v.SSLKeyPath, &v.Status, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if pgx.ErrNoRows == err { return fiber.ErrNotFound }
		return fiber.NewError(500, err.Error())
	}
	return c.JSON(v)
}

func (h *Handler) CreateVhost(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	var body struct {
		DomainName   string  `json:"domain_name"`
		ServerType   string  `json:"server_type"`
		DocumentRoot string  `json:"document_root"`
		PHPVersion   *string `json:"php_version"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.DomainName == "" { return fiber.NewError(400, "domain_name is required") }
	if body.ServerType == "" { body.ServerType = "nginx" }
	if body.DocumentRoot == "" { body.DocumentRoot = "/var/www/" + body.DomainName + "/public_html" }
	if body.PHPVersion != nil && *body.PHPVersion == "" { body.PHPVersion = nil }
	id := uuid.New()
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO vhosts (id, organization_id, domain_name, server_type, document_root, php_version, status)
		 VALUES ($1,$2,$3,$4,$5,$6,'active')`,
		id, orgID, strings.ToLower(body.DomainName), body.ServerType, body.DocumentRoot, body.PHPVersion)
	if err != nil {
		if strings.Contains(err.Error(), "unique") { return fiber.NewError(409, "vhost already exists") }
		return fiber.NewError(500, err.Error())
	}
	return c.Status(201).JSON(fiber.Map{
		"id": id, "domain_name": body.DomainName, "server_type": body.ServerType,
		"document_root": body.DocumentRoot, "status": "active",
	})
}

func (h *Handler) UpdateVhost(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	var body struct {
		PHPVersion *string `json:"php_version"`
		ServerType string  `json:"server_type"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.PHPVersion != nil && *body.PHPVersion == "" { body.PHPVersion = nil }
	ct, err := h.db.Exec(c.Context(),
		`UPDATE vhosts SET php_version=$1, server_type=COALESCE(NULLIF($2,''),server_type), updated_at=NOW()
		 WHERE id=$3 AND organization_id=$4`,
		body.PHPVersion, body.ServerType, id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.JSON(fiber.Map{"message": "updated"})
}

func (h *Handler) DeleteVhost(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	ct, err := h.db.Exec(c.Context(), `DELETE FROM vhosts WHERE id=$1 AND organization_id=$2`, id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.SendStatus(204)
}

func (h *Handler) ListSSL(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	rows, err := h.db.Query(c.Context(),
		`SELECT id, organization_id, domain, provider, status, expires_at, created_at
		 FROM ssl_certificates WHERE organization_id=$1 ORDER BY domain`, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	defer rows.Close()
	list := []SSLCert{}
	for rows.Next() {
		var s SSLCert
		if err := rows.Scan(&s.ID, &s.OrganizationID, &s.Domain, &s.Provider, &s.Status, &s.ExpiresAt, &s.CreatedAt); err != nil {
			return fiber.NewError(500, err.Error())
		}
		list = append(list, s)
	}
	return c.JSON(fiber.Map{"certificates": list, "total": len(list)})
}

func (h *Handler) IssueSSL(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	var body struct {
		Domain   string `json:"domain"`
		Provider string `json:"provider"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.Domain == "" { return fiber.NewError(400, "domain is required") }
	if body.Provider == "" { body.Provider = "letsencrypt" }
	id := uuid.New()
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO ssl_certificates (id, organization_id, domain, provider, status)
		 VALUES ($1,$2,$3,$4,'pending')
		 ON CONFLICT (organization_id, domain) DO UPDATE SET status='pending', provider=$4`,
		id, orgID, body.Domain, body.Provider)
	if err != nil { return fiber.NewError(500, err.Error()) }
	return c.Status(202).JSON(fiber.Map{
		"id": id, "domain": body.Domain, "provider": body.Provider,
		"status":  "pending",
		"message": "SSL certificate issuance queued. This may take a few minutes.",
	})
}

func (h *Handler) DeleteSSL(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	ct, err := h.db.Exec(c.Context(), `DELETE FROM ssl_certificates WHERE id=$1 AND organization_id=$2`, id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.SendStatus(204)
}

func (h *Handler) ListPHP(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"versions": []string{"8.3", "8.2", "8.1", "8.0", "7.4"}})
}

func (h *Handler) UpdatePHP(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	vhostID, err := uuid.Parse(c.Params("vhostId"))
	if err != nil { return fiber.ErrBadRequest }
	var body struct{ PHPVersion *string `json:"php_version"` }
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.PHPVersion != nil && *body.PHPVersion == "" { body.PHPVersion = nil }
	ct, err := h.db.Exec(c.Context(),
		`UPDATE vhosts SET php_version=$1, updated_at=NOW() WHERE id=$2 AND organization_id=$3`,
		body.PHPVersion, vhostID, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.JSON(fiber.Map{"message": "PHP version updated"})
}
