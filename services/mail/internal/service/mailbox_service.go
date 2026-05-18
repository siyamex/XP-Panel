package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/mail/internal/crypto"
	"github.com/xp-panel/xp-panel/services/mail/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrMailboxNotFound   = errors.New("mailbox not found")
	ErrMailboxExists     = errors.New("mailbox already exists")
	ErrForwarderNotFound = errors.New("forwarder not found")
	ErrDKIMNotFound      = errors.New("dkim key not found")
)

type MailboxService struct {
	db *pgxpool.Pool
}

func NewMailboxService(db *pgxpool.Pool) *MailboxService {
	return &MailboxService{db: db}
}

// ─── Mailboxes ───────────────────────────────────────────────────────────────

func (s *MailboxService) ListMailboxes(ctx context.Context, orgID uuid.UUID) ([]domain.Mailbox, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, organization_id, domain_id, local_part, domain,
		       quota_mb, used_mb, active, created_at, updated_at
		FROM mailboxes WHERE organization_id = $1 ORDER BY domain, local_part`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.Mailbox
	for rows.Next() {
		var m domain.Mailbox
		if err := rows.Scan(&m.ID, &m.OrganizationID, &m.DomainID, &m.LocalPart,
			&m.Domain, &m.QuotaMB, &m.UsedMB, &m.Active, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Email = m.LocalPart + "@" + m.Domain
		list = append(list, m)
	}
	return list, nil
}

func (s *MailboxService) CreateMailbox(ctx context.Context, orgID uuid.UUID, req domain.CreateMailboxRequest) (*domain.Mailbox, error) {
	var exists bool
	_ = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM mailboxes WHERE local_part=$1 AND domain=$2)`,
		req.LocalPart, req.Domain).Scan(&exists)
	if exists {
		return nil, ErrMailboxExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	quota := req.QuotaMB
	if quota == 0 {
		quota = 1024
	}

	m := domain.Mailbox{
		ID:             uuid.New(),
		OrganizationID: orgID,
		LocalPart:      req.LocalPart,
		Domain:         req.Domain,
		QuotaMB:        quota,
		Active:         true,
	}
	m.Email = m.LocalPart + "@" + m.Domain

	_, err = s.db.Exec(ctx, `
		INSERT INTO mailboxes (id, organization_id, local_part, domain, password_hash, quota_mb, active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		m.ID, m.OrganizationID, m.LocalPart, m.Domain, string(hash), m.QuotaMB, m.Active)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *MailboxService) UpdateMailbox(ctx context.Context, id, orgID uuid.UUID, req domain.UpdateMailboxRequest) (*domain.Mailbox, error) {
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		_, err = s.db.Exec(ctx, `UPDATE mailboxes SET password_hash = $1 WHERE id = $2 AND organization_id = $3`,
			string(hash), id, orgID)
		if err != nil {
			return nil, err
		}
	}
	if req.QuotaMB > 0 {
		_, _ = s.db.Exec(ctx, `UPDATE mailboxes SET quota_mb = $1 WHERE id = $2 AND organization_id = $3`,
			req.QuotaMB, id, orgID)
	}
	if req.Active != nil {
		_, _ = s.db.Exec(ctx, `UPDATE mailboxes SET active = $1 WHERE id = $2 AND organization_id = $3`,
			*req.Active, id, orgID)
	}

	var m domain.Mailbox
	err := s.db.QueryRow(ctx, `
		SELECT id, organization_id, domain_id, local_part, domain, quota_mb, used_mb, active, created_at, updated_at
		FROM mailboxes WHERE id = $1 AND organization_id = $2`, id, orgID).
		Scan(&m.ID, &m.OrganizationID, &m.DomainID, &m.LocalPart, &m.Domain,
			&m.QuotaMB, &m.UsedMB, &m.Active, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMailboxNotFound
		}
		return nil, err
	}
	m.Email = m.LocalPart + "@" + m.Domain
	return &m, nil
}

func (s *MailboxService) DeleteMailbox(ctx context.Context, id, orgID uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM mailboxes WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrMailboxNotFound
	}
	return nil
}

// ─── Forwarders ──────────────────────────────────────────────────────────────

func (s *MailboxService) ListForwarders(ctx context.Context, orgID uuid.UUID) ([]domain.Forwarder, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, organization_id, source_local, source_domain, destinations, active, created_at, updated_at
		FROM email_forwarders WHERE organization_id = $1 ORDER BY source_domain, source_local`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.Forwarder
	for rows.Next() {
		var f domain.Forwarder
		if err := rows.Scan(&f.ID, &f.OrganizationID, &f.SourceLocal, &f.SourceDomain,
			&f.Destinations, &f.Active, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		f.Source = f.SourceLocal + "@" + f.SourceDomain
		list = append(list, f)
	}
	return list, nil
}

func (s *MailboxService) CreateForwarder(ctx context.Context, orgID uuid.UUID, req domain.CreateForwarderRequest) (*domain.Forwarder, error) {
	f := domain.Forwarder{
		ID:             uuid.New(),
		OrganizationID: orgID,
		SourceLocal:    req.SourceLocal,
		SourceDomain:   req.SourceDomain,
		Destinations:   req.Destinations,
		Active:         true,
	}
	f.Source = f.SourceLocal + "@" + f.SourceDomain

	_, err := s.db.Exec(ctx, `
		INSERT INTO email_forwarders (id, organization_id, source_local, source_domain, destinations, active)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		f.ID, f.OrganizationID, f.SourceLocal, f.SourceDomain, f.Destinations, f.Active)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (s *MailboxService) DeleteForwarder(ctx context.Context, id, orgID uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM email_forwarders WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrForwarderNotFound
	}
	return nil
}

// ─── DKIM ─────────────────────────────────────────────────────────────────────

func (s *MailboxService) GetDKIM(ctx context.Context, domainName string, orgID uuid.UUID) (*domain.DKIMKey, error) {
	var k domain.DKIMKey
	err := s.db.QueryRow(ctx, `
		SELECT id, organization_id, domain, selector, public_key, dns_txt_value, key_size, active, created_at, updated_at
		FROM dkim_keys WHERE domain = $1 AND organization_id = $2`, domainName, orgID).
		Scan(&k.ID, &k.OrganizationID, &k.Domain, &k.Selector, &k.PublicKey,
			&k.DNSTxtValue, &k.KeySize, &k.Active, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrDKIMNotFound
		}
		return nil, err
	}
	return &k, nil
}

func (s *MailboxService) GenerateDKIM(ctx context.Context, orgID uuid.UUID, req domain.GenerateDKIMRequest) (*domain.DKIMKey, error) {
	selector := req.Selector
	if selector == "" {
		selector = "default"
	}
	keySize := req.KeySize
	if keySize == 0 {
		keySize = 2048
	}

	pair, err := crypto.GenerateRSAKeyPair(keySize)
	if err != nil {
		return nil, fmt.Errorf("generate dkim key: %w", err)
	}

	// Hash private key for storage (in production, encrypt with Vault)
	privHash := fmt.Sprintf("%x", sha256.Sum256([]byte(pair.PrivateKeyPEM)))
	_ = privHash

	k := domain.DKIMKey{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Domain:         req.Domain,
		Selector:       selector,
		PublicKey:      pair.PublicKeyPEM,
		DNSTxtValue:    pair.DNSTxtValue,
		KeySize:        keySize,
		Active:         true,
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO dkim_keys (id, organization_id, domain, selector, private_key, public_key, dns_txt_value, key_size, active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (domain) DO UPDATE SET
		  selector = EXCLUDED.selector, private_key = EXCLUDED.private_key,
		  public_key = EXCLUDED.public_key, dns_txt_value = EXCLUDED.dns_txt_value,
		  key_size = EXCLUDED.key_size, updated_at = NOW()`,
		k.ID, k.OrganizationID, k.Domain, k.Selector, pair.PrivateKeyPEM,
		k.PublicKey, k.DNSTxtValue, k.KeySize, k.Active)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (s *MailboxService) DeleteDKIM(ctx context.Context, domainName string, orgID uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM dkim_keys WHERE domain = $1 AND organization_id = $2`, domainName, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrDKIMNotFound
	}
	return nil
}
