package handler

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

type Mailbox struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Domain         string    `json:"domain"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	QuotaMB        int       `json:"quota_mb"`
	UsedMB         int       `json:"used_mb"`
	Enabled        bool      `json:"enabled"`
	CreatedAt      time.Time `json:"created_at"`
}

func (h *Handler) ListMailboxes(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	rows, err := h.db.Query(c.Context(),
		`SELECT id, organization_id, domain, username, email, quota_mb, used_mb, enabled, created_at
		 FROM mailboxes WHERE organization_id=$1 ORDER BY email`, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	defer rows.Close()
	list := []Mailbox{}
	for rows.Next() {
		var m Mailbox
		if err := rows.Scan(&m.ID, &m.OrganizationID, &m.Domain, &m.Username, &m.Email,
			&m.QuotaMB, &m.UsedMB, &m.Enabled, &m.CreatedAt); err != nil {
			return fiber.NewError(500, err.Error())
		}
		list = append(list, m)
	}
	return c.JSON(fiber.Map{"mailboxes": list, "total": len(list)})
}

func (h *Handler) CreateMailbox(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	var body struct {
		Domain     string `json:"domain"`
		Username   string `json:"username"`
		LocalPart  string `json:"local_part"`
		Password   string `json:"password"`
		QuotaMB    int    `json:"quota_mb"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.Username == "" { body.Username = body.LocalPart }
	if body.Domain == "" || body.Username == "" || body.Password == "" {
		return fiber.NewError(400, "domain, username and password are required")
	}
	if body.QuotaMB == 0 { body.QuotaMB = 1024 }
	email := strings.ToLower(body.Username) + "@" + strings.ToLower(body.Domain)
	id := uuid.New()
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO mailboxes (id, organization_id, domain, username, email, password_hash, quota_mb)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, orgID, body.Domain, body.Username, email, hashPassword(body.Password), body.QuotaMB)
	if err != nil {
		if strings.Contains(err.Error(), "unique") { return fiber.NewError(409, "mailbox already exists") }
		return fiber.NewError(500, err.Error())
	}
	return c.Status(201).JSON(fiber.Map{"id": id, "email": email, "quota_mb": body.QuotaMB})
}

func (h *Handler) DeleteMailbox(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	ct, err := h.db.Exec(c.Context(), `DELETE FROM mailboxes WHERE id=$1 AND organization_id=$2`, id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.SendStatus(204)
}

func (h *Handler) ChangePassword(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	var body struct{ Password string `json:"password"` }
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	ct, err := h.db.Exec(c.Context(),
		`UPDATE mailboxes SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND organization_id=$3`,
		hashPassword(body.Password), id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.JSON(fiber.Map{"message": "password updated"})
}

type Forwarder struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	SourceLocal    string    `json:"source_local"`
	SourceDomain   string    `json:"source_domain"`
	Source         string    `json:"source"`
	Destinations   []string  `json:"destinations"`
	Enabled        bool      `json:"enabled"`
	CreatedAt      time.Time `json:"created_at"`
}

func (h *Handler) ListForwarders(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	rows, err := h.db.Query(c.Context(),
		`SELECT id, organization_id, source_local, source_domain, destinations, active, created_at
		 FROM email_forwarders WHERE organization_id=$1 ORDER BY source_local`, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	defer rows.Close()
	list := []Forwarder{}
	for rows.Next() {
		var f Forwarder
		if err := rows.Scan(&f.ID, &f.OrganizationID, &f.SourceLocal, &f.SourceDomain, &f.Destinations, &f.Enabled, &f.CreatedAt); err != nil {
			return fiber.NewError(500, err.Error())
		}
		f.Source = f.SourceLocal + "@" + f.SourceDomain
		list = append(list, f)
	}
	return c.JSON(fiber.Map{"forwarders": list, "total": len(list)})
}

func (h *Handler) CreateForwarder(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	var body struct {
		Source       string   `json:"source"`
		Destinations []string `json:"destinations"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.Source == "" || len(body.Destinations) == 0 {
		return fiber.NewError(400, "source and destinations are required")
	}
	parts := strings.SplitN(strings.ToLower(body.Source), "@", 2)
	if len(parts) != 2 { return fiber.NewError(400, "source must be a valid email address") }
	id := uuid.New()
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO email_forwarders (id, organization_id, source_local, source_domain, destinations) VALUES ($1,$2,$3,$4,$5)`,
		id, orgID, parts[0], parts[1], body.Destinations)
	if err != nil {
		if strings.Contains(err.Error(), "unique") { return fiber.NewError(409, "forwarder already exists") }
		return fiber.NewError(500, err.Error())
	}
	return c.Status(201).JSON(fiber.Map{"id": id, "source": body.Source, "destinations": body.Destinations})
}

func (h *Handler) DeleteForwarder(c *fiber.Ctx) error {
	orgID, _ := uuid.Parse(c.Get("X-Org-ID"))
	id, err := uuid.Parse(c.Params("id"))
	if err != nil { return fiber.ErrBadRequest }
	ct, err := h.db.Exec(c.Context(),
		`DELETE FROM email_forwarders WHERE id=$1 AND organization_id=$2`, id, orgID)
	if err != nil { return fiber.NewError(500, err.Error()) }
	if ct.RowsAffected() == 0 { return fiber.ErrNotFound }
	return c.SendStatus(204)
}

func (h *Handler) GenerateDKIM(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	var body struct {
		Domain   string `json:"domain"`
		Selector string `json:"selector"`
	}
	if err := c.BodyParser(&body); err != nil { return fiber.ErrBadRequest }
	if body.Domain == "" { return fiber.NewError(400, "domain is required") }
	if body.Selector == "" { body.Selector = "default" }
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil { return fiber.NewError(500, "key generation failed") }
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)})
	pubDER, _ := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	pubB64 := base64.StdEncoding.EncodeToString(pubDER)
	dnsTxtValue := "v=DKIM1; k=rsa; p=" + pubB64
	id := uuid.New()
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO dkim_keys (id, organization_id, domain, selector, private_key, public_key, dns_txt_value)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 ON CONFLICT (domain) DO UPDATE SET selector=$4, private_key=$5, public_key=$6, dns_txt_value=$7`,
		id, orgID, body.Domain, body.Selector, string(privPEM), pubB64, dnsTxtValue)
	if err != nil { return fiber.NewError(500, err.Error()) }
	return c.Status(201).JSON(fiber.Map{
		"id": id, "domain": body.Domain, "selector": body.Selector,
		"dns_name":   body.Selector + "._domainkey." + body.Domain,
		"dns_record": dnsTxtValue,
	})
}

func (h *Handler) GetDKIM(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil { return fiber.ErrUnauthorized }
	domain := c.Params("domain")
	var id uuid.UUID
	var selector, dnsRecord string
	var enabled bool
	err = h.db.QueryRow(c.Context(),
		`SELECT id, selector, dns_txt_value, active FROM dkim_keys WHERE domain=$1 AND organization_id=$2`,
		domain, orgID).Scan(&id, &selector, &dnsRecord, &enabled)
	if err != nil { return fiber.ErrNotFound }
	return c.JSON(fiber.Map{
		"id": id, "domain": domain, "selector": selector,
		"dns_name": selector + "._domainkey." + domain,
		"dns_record": dnsRecord, "enabled": enabled,
	})
}

func hashPassword(pw string) string {
	h := sha256.Sum256([]byte(pw))
	return "{SHA256}" + hex.EncodeToString(h[:])
}
