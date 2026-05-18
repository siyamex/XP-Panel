package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/webserver/internal/domain"
)

var (
	ErrCertNotFound = errors.New("ssl certificate not found")
	ErrCertExists   = errors.New("ssl certificate already exists")
)

type SSLService struct {
	db     *pgxpool.Pool
	dryRun bool
}

func NewSSLService(db *pgxpool.Pool, dryRun bool) *SSLService {
	return &SSLService{db: db, dryRun: dryRun}
}

func (s *SSLService) ListCertificates(ctx context.Context, orgID uuid.UUID) ([]domain.SSLCertificate, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, organization_id, domain, san_domains, issuer, expires_at,
		       auto_renew, provider, challenge_type, status, last_error, created_at, updated_at
		FROM ssl_certificates WHERE organization_id = $1 ORDER BY domain`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.SSLCertificate
	for rows.Next() {
		var c domain.SSLCertificate
		if err := rows.Scan(&c.ID, &c.OrganizationID, &c.Domain, &c.SANDomains,
			&c.Issuer, &c.ExpiresAt, &c.AutoRenew, &c.Provider, &c.ChallengeType,
			&c.Status, &c.LastError, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *SSLService) IssueCertificate(ctx context.Context, orgID uuid.UUID, req domain.IssueSSLRequest) (*domain.SSLCertificate, error) {
	provider := req.Provider
	if provider == "" {
		provider = "letsencrypt"
	}
	challengeType := req.ChallengeType
	if challengeType == "" {
		challengeType = "http"
	}

	cert := domain.SSLCertificate{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Domain:         req.Domain,
		SANDomains:     req.SANDomains,
		AutoRenew:      true,
		Provider:       provider,
		ChallengeType:  challengeType,
		Status:         "pending",
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO ssl_certificates (id, organization_id, domain, san_domains, auto_renew, provider, challenge_type, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		cert.ID, cert.OrganizationID, cert.Domain, cert.SANDomains,
		cert.AutoRenew, cert.Provider, cert.ChallengeType, cert.Status)
	if err != nil {
		return nil, err
	}

	// In production: dispatch async job to obtain cert via lego/ACME
	// For now: mark as active with a placeholder expiry (simulated)
	if s.dryRun {
		expiry := time.Now().Add(90 * 24 * time.Hour)
		_, _ = s.db.Exec(ctx, `UPDATE ssl_certificates SET status = 'active', expires_at = $1, issuer = 'Let''s Encrypt' WHERE id = $2`,
			expiry, cert.ID)
		cert.Status = "active"
		cert.ExpiresAt = &expiry
		cert.Issuer = "Let's Encrypt"
	}

	return &cert, nil
}

func (s *SSLService) RenewCertificate(ctx context.Context, id, orgID uuid.UUID) (*domain.SSLCertificate, error) {
	var cert domain.SSLCertificate
	err := s.db.QueryRow(ctx, `SELECT id, domain, status FROM ssl_certificates WHERE id = $1 AND organization_id = $2`,
		id, orgID).Scan(&cert.ID, &cert.Domain, &cert.Status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCertNotFound
		}
		return nil, err
	}

	expiry := time.Now().Add(90 * 24 * time.Hour)
	_, err = s.db.Exec(ctx, `UPDATE ssl_certificates SET status = 'active', expires_at = $1, last_error = NULL WHERE id = $2`,
		expiry, id)
	if err != nil {
		return nil, err
	}
	cert.Status = "active"
	cert.ExpiresAt = &expiry
	return &cert, nil
}

func (s *SSLService) DeleteCertificate(ctx context.Context, id, orgID uuid.UUID) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM ssl_certificates WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrCertNotFound
	}
	return nil
}

// VHostService wraps all webserver services
type VHostService struct {
	db    *pgxpool.Pool
	nginx *NginxService
	php   *PHPService
}

func NewVHostService(db *pgxpool.Pool, nginx *NginxService, php *PHPService) *VHostService {
	return &VHostService{db: db, nginx: nginx, php: php}
}

var (
	ErrVHostNotFound = errors.New("vhost not found")
	ErrVHostExists   = errors.New("vhost already exists")
)

func (s *VHostService) ListVHosts(ctx context.Context, orgID uuid.UUID) ([]domain.VHost, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, organization_id, domain_name, document_root, server_type, php_version,
		       ssl_enabled, status, created_at, updated_at
		FROM vhosts WHERE organization_id = $1 ORDER BY domain_name`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.VHost
	for rows.Next() {
		var v domain.VHost
		if err := rows.Scan(&v.ID, &v.OrganizationID, &v.DomainName, &v.DocumentRoot,
			&v.ServerType, &v.PHPVersion, &v.SSLEnabled, &v.Status,
			&v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, nil
}

func (s *VHostService) CreateVHost(ctx context.Context, orgID uuid.UUID, req domain.CreateVHostRequest) (*domain.VHost, error) {
	var exists bool
	_ = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM vhosts WHERE domain_name = $1)`, req.DomainName).Scan(&exists)
	if exists {
		return nil, ErrVHostExists
	}

	docRoot := req.DocumentRoot
	if docRoot == "" {
		docRoot = fmt.Sprintf("/var/www/%s/public_html", req.DomainName)
	}
	serverType := req.ServerType
	if serverType == "" {
		serverType = "nginx"
	}

	v := domain.VHost{
		ID:             uuid.New(),
		OrganizationID: orgID,
		DomainName:     req.DomainName,
		DocumentRoot:   docRoot,
		ServerType:     serverType,
		PHPVersion:     req.PHPVersion,
		Status:         "active",
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO vhosts (id, organization_id, domain_name, document_root, server_type, php_version, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		v.ID, v.OrganizationID, v.DomainName, v.DocumentRoot, v.ServerType, v.PHPVersion, v.Status)
	if err != nil {
		return nil, err
	}

	// Write nginx config
	_ = s.nginx.WriteVHost(NginxVHostData(v))
	return &v, nil
}

func (s *VHostService) DeleteVHost(ctx context.Context, id, orgID uuid.UUID) error {
	var v domain.VHost
	err := s.db.QueryRow(ctx, `SELECT domain_name, server_type FROM vhosts WHERE id = $1 AND organization_id = $2`,
		id, orgID).Scan(&v.DomainName, &v.ServerType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrVHostNotFound
		}
		return err
	}

	_, err = s.db.Exec(ctx, `DELETE FROM vhosts WHERE id = $1`, id)
	if err != nil {
		return err
	}

	_ = s.nginx.RemoveVHost(v.DomainName)
	return nil
}

func NginxVHostData(v domain.VHost) NginxVHostTemplateData {
	return NginxVHostTemplateData{
		Domain:       v.DomainName,
		DocumentRoot: v.DocumentRoot,
		PHPVersion:   v.PHPVersion,
		SSLEnabled:   v.SSLEnabled,
	}
}

type NginxVHostTemplateData = VHostTemplateData
