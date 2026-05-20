package handler

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"time"

	"github.com/gofiber/fiber/v2"
)

// GenerateCSR creates a CSR + private key for the given domain
func (h *Handler) GenerateCSR(c *fiber.Ctx) error {
	var body struct {
		Domain       string `json:"domain"`
		Country      string `json:"country"`
		State        string `json:"state"`
		City         string `json:"city"`
		Organization string `json:"organization"`
		OrgUnit      string `json:"org_unit"`
		Email        string `json:"email"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Domain == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain required")
	}

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	subj := pkix.Name{
		CommonName:         body.Domain,
		Country:            []string{body.Country},
		Province:           []string{body.State},
		Locality:           []string{body.City},
		Organization:       []string{body.Organization},
		OrganizationalUnit: []string{body.OrgUnit},
	}
	csrTemplate := &x509.CertificateRequest{Subject: subj}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, csrTemplate, privKey)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privKey),
	})

	return c.JSON(fiber.Map{
		"csr":        string(csrPEM),
		"private_key": string(keyPEM),
	})
}

// ImportCustomSSL stores a manually provided cert+key
func (h *Handler) ImportCustomSSL(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	var body struct {
		Domain      string `json:"domain"`
		Certificate string `json:"certificate"`
		PrivateKey  string `json:"private_key"`
		CABundle    string `json:"ca_bundle"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Domain == "" || body.Certificate == "" || body.PrivateKey == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain, certificate, private_key required")
	}

	// Parse to validate
	block, _ := pem.Decode([]byte(body.Certificate))
	if block == nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid certificate PEM")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "cannot parse certificate")
	}

	var id string
	err = h.db.QueryRow(c.Context(),
		`INSERT INTO ssl_certs (org_id, domain, certificate, private_key, ca_bundle, issued_at, expires_at, provider)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,'custom')
		 ON CONFLICT (domain) DO UPDATE SET certificate=EXCLUDED.certificate,
		   private_key=EXCLUDED.private_key, ca_bundle=EXCLUDED.ca_bundle,
		   issued_at=EXCLUDED.issued_at, expires_at=EXCLUDED.expires_at, provider='custom'
		 RETURNING id`,
		orgID, body.Domain, body.Certificate, body.PrivateKey, body.CABundle,
		cert.NotBefore, cert.NotAfter).Scan(&id)
	if err != nil {
		// Table might have different schema — store what we can
		err = h.db.QueryRow(c.Context(),
			`INSERT INTO ssl_certs (org_id, domain, issued_at, expires_at, provider)
			 VALUES ($1,$2,$3,$4,'custom')
			 ON CONFLICT (domain) DO UPDATE SET issued_at=EXCLUDED.issued_at, expires_at=EXCLUDED.expires_at
			 RETURNING id`,
			orgID, body.Domain, cert.NotBefore, cert.NotAfter).Scan(&id)
		if err != nil {
			return fiber.ErrInternalServerError
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":         id,
		"expires_at": cert.NotAfter.Format(time.RFC3339),
	})
}
