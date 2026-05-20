package handler

import (
	"crypto/md5"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ─── Subdomains ───────────────────────────────────────────────────────────────

type subdomain struct {
	ID           string    `json:"id"`
	Domain       string    `json:"domain"`
	Subdomain    string    `json:"subdomain"`
	DocumentRoot string    `json:"document_root"`
	RedirectTo   *string   `json:"redirect_to"`
	CreatedAt    time.Time `json:"created_at"`
}

func (h *Handler) ListSubdomains(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	domain := c.Query("domain")
	query := `SELECT id, domain, subdomain, document_root, redirect_to, created_at FROM subdomains WHERE org_id=$1`
	args := []interface{}{orgID}
	if domain != "" {
		query += " AND domain=$2"
		args = append(args, domain)
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.db.Query(c.Context(), query, args...)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	items := []subdomain{}
	for rows.Next() {
		var s subdomain
		if err := rows.Scan(&s.ID, &s.Domain, &s.Subdomain, &s.DocumentRoot, &s.RedirectTo, &s.CreatedAt); err != nil {
			continue
		}
		items = append(items, s)
	}
	return c.JSON(fiber.Map{"subdomains": items, "total": len(items)})
}

func (h *Handler) CreateSubdomain(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Domain       string  `json:"domain"`
		Subdomain    string  `json:"subdomain"`
		DocumentRoot string  `json:"document_root"`
		RedirectTo   *string `json:"redirect_to"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Domain == "" || body.Subdomain == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain and subdomain required")
	}
	if body.DocumentRoot == "" {
		body.DocumentRoot = fmt.Sprintf("/var/www/%s/%s", body.Domain, body.Subdomain)
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO subdomains (org_id, domain, subdomain, document_root, redirect_to)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		orgID, body.Domain, body.Subdomain, body.DocumentRoot, body.RedirectTo).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) DeleteSubdomain(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM subdomains WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Redirects ────────────────────────────────────────────────────────────────

type redirect struct {
	ID          string    `json:"id"`
	Domain      string    `json:"domain"`
	SourcePath  string    `json:"source_path"`
	Destination string    `json:"destination"`
	Type        int       `json:"type"`
	Wildcard    bool      `json:"wildcard"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *Handler) ListRedirects(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, domain, source_path, destination, type, wildcard, enabled, created_at
		 FROM domain_redirects WHERE org_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	items := []redirect{}
	for rows.Next() {
		var r redirect
		if err := rows.Scan(&r.ID, &r.Domain, &r.SourcePath, &r.Destination, &r.Type, &r.Wildcard, &r.Enabled, &r.CreatedAt); err != nil {
			continue
		}
		items = append(items, r)
	}
	return c.JSON(fiber.Map{"redirects": items, "total": len(items)})
}

func (h *Handler) CreateRedirect(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Domain      string `json:"domain"`
		SourcePath  string `json:"source_path"`
		Destination string `json:"destination"`
		Type        int    `json:"type"`
		Wildcard    bool   `json:"wildcard"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Domain == "" || body.Destination == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain and destination required")
	}
	if body.Type != 301 && body.Type != 302 {
		body.Type = 301
	}
	if body.SourcePath == "" {
		body.SourcePath = "/"
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO domain_redirects (org_id, domain, source_path, destination, type, wildcard)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		orgID, body.Domain, body.SourcePath, body.Destination, body.Type, body.Wildcard).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) DeleteRedirect(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM domain_redirects WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Error Pages ──────────────────────────────────────────────────────────────

func (h *Handler) ListErrorPages(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	domain := c.Query("domain")

	rows, err := h.db.Query(c.Context(),
		`SELECT id, domain, error_code, html_content, updated_at
		 FROM domain_error_pages WHERE org_id=$1 AND domain=$2`, orgID, domain)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	type errorPage struct {
		ID          string    `json:"id"`
		Domain      string    `json:"domain"`
		ErrorCode   int       `json:"error_code"`
		HTMLContent string    `json:"html_content"`
		UpdatedAt   time.Time `json:"updated_at"`
	}
	pages := []errorPage{}
	for rows.Next() {
		var p errorPage
		if err := rows.Scan(&p.ID, &p.Domain, &p.ErrorCode, &p.HTMLContent, &p.UpdatedAt); err != nil {
			continue
		}
		pages = append(pages, p)
	}
	return c.JSON(fiber.Map{"pages": pages})
}

func (h *Handler) UpsertErrorPage(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Domain      string `json:"domain"`
		ErrorCode   int    `json:"error_code"`
		HTMLContent string `json:"html_content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Domain == "" || body.ErrorCode == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "domain and error_code required")
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO domain_error_pages (org_id, domain, error_code, html_content)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (domain, error_code) DO UPDATE SET html_content=EXCLUDED.html_content, updated_at=NOW()
		 RETURNING id`,
		orgID, body.Domain, body.ErrorCode, body.HTMLContent).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"id": id})
}

// ─── Directory Privacy ────────────────────────────────────────────────────────

func (h *Handler) ListDirectoryPrivacy(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	domain := c.Query("domain")

	rows, err := h.db.Query(c.Context(),
		`SELECT id, domain, path, realm, enabled, created_at
		 FROM directory_privacy WHERE org_id=$1 AND domain=$2`, orgID, domain)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	type privEntry struct {
		ID        string    `json:"id"`
		Domain    string    `json:"domain"`
		Path      string    `json:"path"`
		Realm     string    `json:"realm"`
		Enabled   bool      `json:"enabled"`
		CreatedAt time.Time `json:"created_at"`
	}
	items := []privEntry{}
	for rows.Next() {
		var p privEntry
		if err := rows.Scan(&p.ID, &p.Domain, &p.Path, &p.Realm, &p.Enabled, &p.CreatedAt); err != nil {
			continue
		}
		items = append(items, p)
	}
	return c.JSON(fiber.Map{"entries": items})
}

func (h *Handler) CreateDirectoryPrivacy(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Domain   string `json:"domain"`
		Path     string `json:"path"`
		Realm    string `json:"realm"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Domain == "" || body.Path == "" || body.Username == "" || body.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain, path, username, password required")
	}
	if body.Realm == "" {
		body.Realm = "Protected Area"
	}

	htpasswd := generateHtpasswd(body.Username, body.Password)

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO directory_privacy (org_id, domain, path, realm, htpasswd)
		 VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (domain, path) DO UPDATE SET realm=EXCLUDED.realm, htpasswd=EXCLUDED.htpasswd
		 RETURNING id`,
		orgID, body.Domain, body.Path, body.Realm, htpasswd).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) DeleteDirectoryPrivacy(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM directory_privacy WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

// generateHtpasswd creates an Apache MD5 htpasswd entry
func generateHtpasswd(username, password string) string {
	h := md5.Sum([]byte(password))
	return fmt.Sprintf("%s:%x", username, h)
}

// ─── SSH Keys ─────────────────────────────────────────────────────────────────

type sshKey struct {
	ID          string    `json:"id"`
	Label       string    `json:"label"`
	PublicKey   string    `json:"public_key"`
	Fingerprint string    `json:"fingerprint"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *Handler) ListSSHKeys(c *fiber.Ctx) error {
	userID := c.Get("X-User-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, label, public_key, fingerprint, created_at
		 FROM ssh_keys WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	keys := []sshKey{}
	for rows.Next() {
		var k sshKey
		if err := rows.Scan(&k.ID, &k.Label, &k.PublicKey, &k.Fingerprint, &k.CreatedAt); err != nil {
			continue
		}
		keys = append(keys, k)
	}
	return c.JSON(fiber.Map{"keys": keys, "total": len(keys)})
}

func (h *Handler) AddSSHKey(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	userID := c.Get("X-User-ID", "")

	var body struct {
		Label     string `json:"label"`
		PublicKey string `json:"public_key"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Label == "" || body.PublicKey == "" {
		return fiber.NewError(fiber.StatusBadRequest, "label and public_key required")
	}

	// Generate fingerprint from public key (MD5 of key data)
	parts := strings.Fields(strings.TrimSpace(body.PublicKey))
	fp := ""
	if len(parts) >= 2 {
		h256 := md5.Sum([]byte(parts[1]))
		fp = fmt.Sprintf("%x", h256)
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO ssh_keys (org_id, user_id, label, public_key, fingerprint)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		orgID, userID, body.Label, strings.TrimSpace(body.PublicKey), fp).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "fingerprint": fp})
}

func (h *Handler) DeleteSSHKey(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Get("X-User-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM ssh_keys WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ─── MySQL Remote Access ──────────────────────────────────────────────────────

type mysqlRemoteEntry struct {
	ID        string    `json:"id"`
	IPAddress string    `json:"ip_address"`
	Label     *string   `json:"label"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *Handler) ListMySQLRemoteAccess(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, ip_address, label, created_at FROM mysql_remote_access WHERE org_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	entries := []mysqlRemoteEntry{}
	for rows.Next() {
		var e mysqlRemoteEntry
		if err := rows.Scan(&e.ID, &e.IPAddress, &e.Label, &e.CreatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return c.JSON(fiber.Map{"entries": entries, "total": len(entries)})
}

func (h *Handler) AddMySQLRemoteAccess(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		IPAddress string  `json:"ip_address"`
		Label     *string `json:"label"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.IPAddress == "" {
		return fiber.NewError(fiber.StatusBadRequest, "ip_address required")
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO mysql_remote_access (org_id, ip_address, label) VALUES ($1,$2,$3)
		 ON CONFLICT (org_id, ip_address) DO UPDATE SET label=EXCLUDED.label RETURNING id`,
		orgID, body.IPAddress, body.Label).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) DeleteMySQLRemoteAccess(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM mysql_remote_access WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}
