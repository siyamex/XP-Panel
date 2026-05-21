package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /ssl — list all SSL certificates for org
func (h *Handler) ListSSLCerts(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, domain_name, subject_alt_names, issuer, status,
		        valid_from, valid_until, cert_path, key_path, auto_renew, created_at
		 FROM ssl_certificates
		 WHERE organization_id=$1 AND status != 'revoked'
		 ORDER BY domain_name`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type Cert struct {
		ID              string    `json:"id"`
		DomainName      string    `json:"domain_name"`
		SubjectAltNames []string  `json:"subject_alt_names"`
		Issuer          string    `json:"issuer"`
		Status          string    `json:"status"`
		ValidFrom       time.Time `json:"valid_from"`
		ValidUntil      time.Time `json:"valid_until"`
		CertPath        string    `json:"cert_path"`
		KeyPath         string    `json:"key_path"`
		AutoRenew       bool      `json:"auto_renew"`
		CreatedAt       time.Time `json:"created_at"`
		DaysUntilExpiry int       `json:"days_until_expiry"`
	}

	certs := []Cert{}
	for rows.Next() {
		var cert Cert
		var sans []string
		if err := rows.Scan(
			&cert.ID, &cert.DomainName, &sans, &cert.Issuer,
			&cert.Status, &cert.ValidFrom, &cert.ValidUntil,
			&cert.CertPath, &cert.KeyPath, &cert.AutoRenew, &cert.CreatedAt,
		); err != nil {
			continue
		}
		cert.SubjectAltNames = sans
		cert.DaysUntilExpiry = int(time.Until(cert.ValidUntil).Hours() / 24)
		certs = append(certs, cert)
	}
	return c.JSON(fiber.Map{"certs": certs, "total": len(certs)})
}

// POST /ssl/issue — issue a Let's Encrypt certificate
func (h *Handler) IssueSSLCert(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var req struct {
		Domain    string   `json:"domain"`
		SANs      []string `json:"sans"`       // subject alternative names
		Email     string   `json:"email"`
		AutoRenew bool     `json:"auto_renew"`
		Webroot   string   `json:"webroot"`    // optional; uses HTTP-01 standalone if empty
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Domain == "" || req.Email == "" {
		return c.Status(400).JSON(fiber.Map{"error": "domain and email are required"})
	}

	domains := append([]string{req.Domain}, req.SANs...)

	cert, err := h.ssl.IssueCertificate(c.Context(), orgID, req.Email, domains, req.Webroot, req.AutoRenew)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(cert)
}

// POST /ssl/renew/:id — force-renew a certificate
func (h *Handler) RenewSSLCert(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}

	cert, err := h.ssl.RenewCertificate(c.Context(), id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(cert)
}

// DELETE /ssl/:id — revoke and delete a certificate
func (h *Handler) DeleteSSLCert(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	ct, err := h.db.Exec(c.Context(),
		`UPDATE ssl_certificates SET status='revoked', updated_at=NOW()
		 WHERE id=$1 AND organization_id=$2`, c.Params("id"), orgID)
	if err != nil || ct.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "certificate not found"})
	}
	return c.SendStatus(204)
}

// GET /ssl/:id — get certificate details
func (h *Handler) GetSSLCert(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var cert struct {
		ID              string    `json:"id"`
		DomainName      string    `json:"domain_name"`
		SubjectAltNames []string  `json:"subject_alt_names"`
		Issuer          string    `json:"issuer"`
		Status          string    `json:"status"`
		ValidFrom       time.Time `json:"valid_from"`
		ValidUntil      time.Time `json:"valid_until"`
		CertPath        string    `json:"cert_path"`
		KeyPath         string    `json:"key_path"`
		AutoRenew       bool      `json:"auto_renew"`
		CreatedAt       time.Time `json:"created_at"`
	}
	err := h.db.QueryRow(c.Context(),
		`SELECT id, domain_name, subject_alt_names, issuer, status,
		        valid_from, valid_until, cert_path, key_path, auto_renew, created_at
		 FROM ssl_certificates WHERE id=$1 AND organization_id=$2`,
		c.Params("id"), orgID,
	).Scan(
		&cert.ID, &cert.DomainName, &cert.SubjectAltNames,
		&cert.Issuer, &cert.Status, &cert.ValidFrom, &cert.ValidUntil,
		&cert.CertPath, &cert.KeyPath, &cert.AutoRenew, &cert.CreatedAt,
	)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "certificate not found"})
	}
	return c.JSON(cert)
}

// PUT /ssl/:id/auto-renew — toggle auto-renew
func (h *Handler) ToggleAutoRenew(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var req struct{ AutoRenew bool `json:"auto_renew"` }
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	ct, err := h.db.Exec(c.Context(),
		`UPDATE ssl_certificates SET auto_renew=$1, updated_at=NOW()
		 WHERE id=$2 AND organization_id=$3`,
		req.AutoRenew, c.Params("id"), orgID,
	)
	if err != nil || ct.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "certificate not found"})
	}
	return c.JSON(fiber.Map{"auto_renew": req.AutoRenew})
}
