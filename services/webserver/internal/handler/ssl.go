package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/webserver/internal/domain"
)

// GET /ssl — list all SSL certificates for org
func (h *Handler) ListSSLCerts(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, domain, san_domains, issuer, status,
		        expires_at, auto_renew, provider, challenge_type, created_at
		 FROM ssl_certificates
		 WHERE organization_id=$1 AND status != 'revoked'
		 ORDER BY domain`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type Cert struct {
		ID              string     `json:"id"`
		Domain          string     `json:"domain_name"`
		SANDomains      []string   `json:"subject_alt_names"`
		Issuer          *string    `json:"issuer"`
		Status          string     `json:"status"`
		ExpiresAt       *time.Time `json:"valid_until"`
		AutoRenew       bool       `json:"auto_renew"`
		Provider        string     `json:"provider"`
		ChallengeType   string     `json:"challenge_type"`
		CreatedAt       time.Time  `json:"created_at"`
		DaysUntilExpiry *int       `json:"days_until_expiry"`
	}

	certs := []Cert{}
	for rows.Next() {
		var cert Cert
		if err := rows.Scan(
			&cert.ID, &cert.Domain, &cert.SANDomains, &cert.Issuer,
			&cert.Status, &cert.ExpiresAt, &cert.AutoRenew,
			&cert.Provider, &cert.ChallengeType, &cert.CreatedAt,
		); err != nil {
			continue
		}
		if cert.ExpiresAt != nil {
			days := int(time.Until(*cert.ExpiresAt).Hours() / 24)
			cert.DaysUntilExpiry = &days
		}
		certs = append(certs, cert)
	}
	return c.JSON(fiber.Map{"certs": certs, "total": len(certs)})
}

// POST /ssl/issue — issue a Let's Encrypt certificate
func (h *Handler) IssueSSLCert(c *fiber.Ctx) error {
	orgIDStr := c.Get("X-Org-ID", "")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid org id"})
	}

	var req struct {
		Domain    string   `json:"domain"`
		SANs      []string `json:"sans"`
		AutoRenew bool     `json:"auto_renew"`
		Provider  string   `json:"provider"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Domain == "" {
		return c.Status(400).JSON(fiber.Map{"error": "domain is required"})
	}

	cert, err := h.ssl.IssueCertificate(c.Context(), orgID, domain.IssueSSLRequest{
		Domain:     req.Domain,
		SANDomains: req.SANs,
		Provider:   req.Provider,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(cert)
}

// POST /ssl/renew/:id — force-renew a certificate
func (h *Handler) RenewSSLCert(c *fiber.Ctx) error {
	orgIDStr := c.Get("X-Org-ID", "")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid org id"})
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}

	cert, err := h.ssl.RenewCertificate(c.Context(), id, orgID)
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
		ID            string     `json:"id"`
		Domain        string     `json:"domain_name"`
		SANDomains    []string   `json:"subject_alt_names"`
		Issuer        *string    `json:"issuer"`
		Status        string     `json:"status"`
		ExpiresAt     *time.Time `json:"valid_until"`
		AutoRenew     bool       `json:"auto_renew"`
		Provider      string     `json:"provider"`
		ChallengeType string     `json:"challenge_type"`
		LastError     *string    `json:"last_error"`
		CreatedAt     time.Time  `json:"created_at"`
	}
	err := h.db.QueryRow(c.Context(),
		`SELECT id, domain, san_domains, issuer, status,
		        expires_at, auto_renew, provider, challenge_type, last_error, created_at
		 FROM ssl_certificates WHERE id=$1 AND organization_id=$2`,
		c.Params("id"), orgID,
	).Scan(
		&cert.ID, &cert.Domain, &cert.SANDomains, &cert.Issuer,
		&cert.Status, &cert.ExpiresAt, &cert.AutoRenew,
		&cert.Provider, &cert.ChallengeType, &cert.LastError, &cert.CreatedAt,
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
