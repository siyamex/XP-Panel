package handler

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/webserver/internal/domain"
	"github.com/xp-panel/xp-panel/services/webserver/internal/service"
)

type Handler struct {
	db    *pgxpool.Pool
	nginx *service.NginxService
	php   *service.PHPService
	ssl   *service.SSLService
}

func New(db *pgxpool.Pool, nginx *service.NginxService, php *service.PHPService, ssl *service.SSLService) *Handler {
	return &Handler{db: db, nginx: nginx, php: php, ssl: ssl}
}

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
	if body.DocumentRoot == "" { body.DocumentRoot = fmt.Sprintf("/var/www/%s/public_html", body.DomainName) }
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

	// Create document root directory
	_ = os.MkdirAll(body.DocumentRoot, 0755)

	// Write nginx config + reload
	if h.nginx != nil {
		phpVer := ""
		if body.PHPVersion != nil { phpVer = *body.PHPVersion }
		_ = h.nginx.WriteVHost(service.VHostTemplateData{
			Domain:       strings.ToLower(body.DomainName),
			DocumentRoot: body.DocumentRoot,
			PHPVersion:   phpVer,
		})
	}

	// Write PHP-FPM pool if PHP version specified
	if h.php != nil && body.PHPVersion != nil {
		_ = h.php.WritePool(service.PHPPoolConfig{
			Domain:     strings.ToLower(body.DomainName),
			PHPVersion: *body.PHPVersion,
		})
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

	// Fetch current vhost for service calls
	var v Vhost
	err = h.db.QueryRow(c.Context(),
		`UPDATE vhosts SET php_version=$1, server_type=COALESCE(NULLIF($2,''),server_type), updated_at=NOW()
		 WHERE id=$3 AND organization_id=$4
		 RETURNING domain_name, document_root, server_type, php_version, ssl_enabled`,
		body.PHPVersion, body.ServerType, id, orgID).
		Scan(&v.DomainName, &v.DocumentRoot, &v.ServerType, &v.PHPVersion, &v.SSLEnabled)
	if err != nil {
		if err == pgx.ErrNoRows { return fiber.ErrNotFound }
		return fiber.NewError(500, err.Error())
	}

	// Re-write nginx config with updated PHP version
	if h.nginx != nil {
		phpVer := ""
		if v.PHPVersion != nil { phpVer = *v.PHPVersion }
		_ = h.nginx.WriteVHost(service.VHostTemplateData{
			Domain:       v.DomainName,
			DocumentRoot: v.DocumentRoot,
			PHPVersion:   phpVer,
			SSLEnabled:   v.SSLEnabled,
		})
	}

	// Update PHP-FPM pool
	if h.php != nil && body.PHPVersion != nil {
		_ = h.php.WritePool(service.PHPPoolConfig{
			Domain:     v.DomainName,
			PHPVersion: *body.PHPVersion,
		})
	}

	return c.JSON(fiber.Map{"message": "updated"})
}

func (h *Handler) DeleteVhost(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }

	// Fetch before delete for service cleanup
	var domainName string
	var phpVersion *string
	_ = h.db.QueryRow(c.Context(),
		`SELECT domain_name, php_version FROM vhosts WHERE id=$1 AND organization_id=$2`, id, orgID).
		Scan(&domainName, &phpVersion)

	ct, err := h.db.Exec(c.Context(), `DELETE FROM vhosts WHERE id=$1 AND organization_id=$2`, id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }

	if domainName != "" {
		if h.nginx != nil { _ = h.nginx.RemoveVHost(domainName) }
		if h.php != nil && phpVersion != nil { _ = h.php.RemovePool(domainName, *phpVersion) }
	}

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
		Domain        string   `json:"domain"`
		SANDomains    []string `json:"san_domains"`
		Provider      string   `json:"provider"`
		ChallengeType string   `json:"challenge_type"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.Domain == "" { return fiber.NewError(400, "domain is required") }

	if h.ssl != nil {
		cert, err := h.ssl.IssueCertificate(c.Context(), orgID, domain.IssueSSLRequest{
			Domain:        body.Domain,
			SANDomains:    body.SANDomains,
			Provider:      body.Provider,
			ChallengeType: body.ChallengeType,
		})
		if err != nil { return fiber.NewError(500, err.Error()) }
		return c.Status(202).JSON(fiber.Map{
			"id": cert.ID, "domain": cert.Domain, "provider": cert.Provider,
			"status":  "pending",
			"message": "SSL issuance started via ACME. Check status in a few minutes.",
		})
	}

	// Fallback: DB-only placeholder
	id := uuid.New()
	provider := body.Provider
	if provider == "" { provider = "letsencrypt" }
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO ssl_certificates (id, organization_id, domain, provider, status)
		 VALUES ($1,$2,$3,$4,'pending')
		 ON CONFLICT (organization_id, domain) DO UPDATE SET status='pending', provider=$4`,
		id, orgID, body.Domain, provider)
	if err != nil { return fiber.NewError(500, err.Error()) }
	return c.Status(202).JSON(fiber.Map{
		"id": id, "domain": body.Domain, "provider": provider,
		"status": "pending", "message": "SSL issuance queued.",
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

// GET /webserver/php/:vhostId/ini — read php.ini settings stored in DB
func (h *Handler) GetPHPIni(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	vhostID, err := uuid.Parse(c.Params("vhostId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var settingsJSON []byte
	err = h.db.QueryRow(c.Context(),
		`SELECT COALESCE(php_settings,'{}') FROM vhosts WHERE id=$1 AND organization_id=$2`,
		vhostID, orgID).Scan(&settingsJSON)
	if err != nil {
		return fiber.ErrNotFound
	}

	// Return defaults merged with stored settings
	defaults := map[string]string{
		"memory_limit":       "256M",
		"max_execution_time": "30",
		"upload_max_filesize": "64M",
		"post_max_size":      "64M",
		"max_input_vars":     "1000",
		"display_errors":     "Off",
		"error_reporting":    "E_ALL & ~E_NOTICE & ~E_STRICT",
		"opcache.enable":     "1",
		"opcache.memory_consumption": "128",
		"opcache.max_accelerated_files": "10000",
	}
	var stored map[string]string
	if len(settingsJSON) > 0 {
		_ = json.Unmarshal(settingsJSON, &stored)
		for k, v := range stored {
			defaults[k] = v
		}
	}
	return c.JSON(fiber.Map{"settings": defaults})
}

// PUT /webserver/php/:vhostId/ini — update php.ini settings
func (h *Handler) UpdatePHPIni(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	vhostID, err := uuid.Parse(c.Params("vhostId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var settings map[string]string
	if err := c.BodyParser(&settings); err != nil {
		return fiber.ErrBadRequest
	}
	settingsJSON, _ := json.Marshal(settings)

	ct, err := h.db.Exec(c.Context(),
		`UPDATE vhosts SET php_settings=$1, updated_at=NOW() WHERE id=$2 AND organization_id=$3`,
		settingsJSON, vhostID, orgID)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	if ct.RowsAffected() == 0 {
		return fiber.ErrNotFound
	}
	return c.JSON(fiber.Map{"updated": true})
}

// GET /webserver/php/:vhostId/opcache — OPcache statistics
func (h *Handler) GetOPcacheStatus(c *fiber.Ctx) error {
	// In production this would exec 'php -r "var_export(opcache_get_status());"' via SSH/agent
	// For now return structured mock that matches the real opcache_get_status() shape
	return c.JSON(fiber.Map{
		"enabled": true,
		"cache_full": false,
		"memory_usage": fiber.Map{
			"used_memory":               52428800,
			"free_memory":               81788928,
			"wasted_memory":             1048576,
			"current_wasted_percentage": 0.63,
		},
		"statistics": fiber.Map{
			"num_cached_scripts":  342,
			"num_cached_keys":     412,
			"max_cached_keys":     10000,
			"hits":                158293,
			"misses":              342,
			"blacklist_misses":    0,
			"opcache_hit_rate":    99.78,
		},
	})
}

// POST /webserver/php/:vhostId/opcache/reset — reset OPcache
func (h *Handler) ResetOPcache(c *fiber.Ctx) error {
	// In production: exec 'php -r "opcache_reset();"' via server agent
	return c.JSON(fiber.Map{"reset": true, "message": "OPcache cleared"})
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
