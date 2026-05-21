package service

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/go-acme/lego/v4/certificate"
	"github.com/go-acme/lego/v4/challenge/http01"
	"github.com/go-acme/lego/v4/lego"
	"github.com/go-acme/lego/v4/registration"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/webserver/internal/domain"
)

func parseCertExpiry(certPEM []byte) time.Time {
	block, _ := pem.Decode(certPEM)
	if block == nil {
		return time.Time{}
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return time.Time{}
	}
	return cert.NotAfter
}

var (
	ErrCertNotFound = errors.New("ssl certificate not found")
	ErrCertExists   = errors.New("ssl certificate already exists")
)

// acmeUser implements lego's registration.User.
type acmeUser struct {
	Email        string
	Registration *registration.Resource
	key          crypto.PrivateKey
}

func (u *acmeUser) GetEmail() string                        { return u.Email }
func (u *acmeUser) GetRegistration() *registration.Resource { return u.Registration }
func (u *acmeUser) GetPrivateKey() crypto.PrivateKey        { return u.key }

// SSLService manages TLS certificates via Let's Encrypt (lego) + DB records.
type SSLService struct {
	db      *pgxpool.Pool
	certsDir string // /etc/xp-panel/certs
	nginx   *NginxService
	acmeEmail string
	staging  bool // use LE staging when true
}

func NewSSLService(db *pgxpool.Pool, nginx *NginxService, certsDir, acmeEmail string, staging bool) *SSLService {
	return &SSLService{db: db, nginx: nginx, certsDir: certsDir, acmeEmail: acmeEmail, staging: staging}
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

// IssueCertificate obtains a certificate via ACME HTTP-01 challenge.
// The caller must ensure port 80 is reachable for the domain.
func (s *SSLService) IssueCertificate(ctx context.Context, orgID uuid.UUID, req domain.IssueSSLRequest) (*domain.SSLCertificate, error) {
	provider := req.Provider
	if provider == "" {
		provider = "letsencrypt"
	}
	challengeType := req.ChallengeType
	if challengeType == "" {
		challengeType = "http"
	}

	certID := uuid.New()
	cert := domain.SSLCertificate{
		ID:             certID,
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
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (organization_id, domain) DO UPDATE
		  SET status='pending', provider=$6, challenge_type=$7, updated_at=NOW()`,
		cert.ID, cert.OrganizationID, cert.Domain, cert.SANDomains,
		cert.AutoRenew, cert.Provider, cert.ChallengeType, cert.Status)
	if err != nil {
		return nil, err
	}

	// Run ACME in background — return immediately with pending status
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := s.runACME(bgCtx, orgID, certID, req.Domain, req.SANDomains); err != nil {
			log.Printf("ACME issuance failed for %s: %v", req.Domain, err)
			errMsg := err.Error()
			_, _ = s.db.Exec(bgCtx,
				`UPDATE ssl_certificates SET status='failed', last_error=$1, updated_at=NOW() WHERE id=$2`,
				errMsg, certID)
		}
	}()

	return &cert, nil
}

func (s *SSLService) runACME(ctx context.Context, orgID, certID uuid.UUID, domain string, sans []string) error {
	// Generate ACME account key
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("generate account key: %w", err)
	}

	user := &acmeUser{Email: s.acmeEmail, key: privKey}
	cfg := lego.NewConfig(user)
	if s.staging {
		cfg.CADirURL = lego.LEDirectoryStaging
	} else {
		cfg.CADirURL = lego.LEDirectoryProduction
	}

	client, err := lego.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("lego client: %w", err)
	}

	// HTTP-01 challenge: serve from /.well-known/acme-challenge/
	webroot := fmt.Sprintf("/var/www/%s/public_html", domain)
	if _, err := os.Stat(webroot); os.IsNotExist(err) {
		webroot = "/var/www/html" // fallback
	}
	if err := client.Challenge.SetHTTP01Provider(
		http01.NewProviderServer("", "80"),
	); err != nil {
		// Fall back to an alternate port if port 80 bind fails
		_ = client.Challenge.SetHTTP01Provider(
			http01.NewProviderServer("", "8880"),
		)
	}
	_ = webroot // used only as hint for config; actual challenge runs via HTTP provider

	// Register account
	reg, err := client.Registration.Register(registration.RegisterOptions{TermsOfServiceAgreed: true})
	if err != nil {
		return fmt.Errorf("register: %w", err)
	}
	user.Registration = reg

	// Build domain list
	domains := []string{domain}
	domains = append(domains, sans...)

	request := certificate.ObtainRequest{Domains: domains, Bundle: true}
	certs, err := client.Certificate.Obtain(request)
	if err != nil {
		return fmt.Errorf("obtain: %w", err)
	}

	// Save cert + key files
	certDir := filepath.Join(s.certsDir, domain)
	if err := os.MkdirAll(certDir, 0700); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	certPath := filepath.Join(certDir, "fullchain.pem")
	keyPath := filepath.Join(certDir, "privkey.pem")
	if err := os.WriteFile(certPath, certs.Certificate, 0600); err != nil {
		return err
	}
	if err := os.WriteFile(keyPath, certs.PrivateKey, 0600); err != nil {
		return err
	}

	// Parse expiry from the certificate PEM
	expiry := parseCertExpiry(certs.Certificate)
	if expiry.IsZero() {
		expiry = time.Now().Add(90 * 24 * time.Hour)
	}

	// Update DB
	_, err = s.db.Exec(ctx,
		`UPDATE ssl_certificates
		 SET status='active', expires_at=$1, issuer='Let''s Encrypt',
		     cert_path=$2, key_path=$3, updated_at=NOW()
		 WHERE id=$4`,
		expiry, certPath, keyPath, certID)
	if err != nil {
		return err
	}

	// Update nginx vhost with SSL paths
	if s.nginx != nil {
		var docRoot, phpVer string
		_ = s.db.QueryRow(ctx,
			`SELECT document_root, COALESCE(php_version,'') FROM vhosts WHERE domain_name=$1 AND organization_id=$2`,
			domain, orgID).Scan(&docRoot, &phpVer)
		_ = s.nginx.WriteVHost(VHostTemplateData{
			Domain:       domain,
			DocumentRoot: docRoot,
			PHPVersion:   phpVer,
			SSLEnabled:   true,
			SSLCertPath:  certPath,
			SSLKeyPath:   keyPath,
		})
		_, _ = s.db.Exec(ctx,
			`UPDATE vhosts SET ssl_enabled=true, ssl_cert_path=$1, ssl_key_path=$2, updated_at=NOW()
			 WHERE domain_name=$3 AND organization_id=$4`,
			certPath, keyPath, domain, orgID)
	}

	log.Printf("SSL certificate issued for %s (expires %s)", domain, expiry.Format("2006-01-02"))
	return nil
}

func (s *SSLService) RenewCertificate(ctx context.Context, id, orgID uuid.UUID) (*domain.SSLCertificate, error) {
	var cert domain.SSLCertificate
	err := s.db.QueryRow(ctx,
		`SELECT id, domain, status, cert_path, key_path FROM ssl_certificates WHERE id = $1 AND organization_id = $2`,
		id, orgID).Scan(&cert.ID, &cert.Domain, &cert.Status, &cert.CertPath, &cert.KeyPath)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCertNotFound
		}
		return nil, err
	}

	// Mark as renewing and kick off background renewal
	_, _ = s.db.Exec(ctx, `UPDATE ssl_certificates SET status='renewing', updated_at=NOW() WHERE id=$1`, id)

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := s.runACME(bgCtx, orgID, id, cert.Domain, nil); err != nil {
			log.Printf("ACME renewal failed for %s: %v", cert.Domain, err)
		}
	}()

	cert.Status = "renewing"
	return &cert, nil
}

// StartAutoRenewal checks every 12 hours for certs expiring within 30 days and renews them.
func (s *SSLService) StartAutoRenewal(ctx context.Context) {
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()
	log.Println("SSL auto-renewal task started (12h interval)")
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.renewExpiring(ctx)
		}
	}
}

func (s *SSLService) renewExpiring(ctx context.Context) {
	rows, err := s.db.Query(ctx,
		`SELECT id, organization_id, domain FROM ssl_certificates
		 WHERE status = 'active' AND auto_renew = TRUE
		   AND expires_at < NOW() + INTERVAL '30 days'`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, orgID uuid.UUID
		var dom string
		if err := rows.Scan(&id, &orgID, &dom); err != nil {
			continue
		}
		log.Printf("auto-renewing SSL for %s", dom)
		_, _ = s.RenewCertificate(ctx, id, orgID)
	}
}

func (s *SSLService) DeleteCertificate(ctx context.Context, id, orgID uuid.UUID) error {
	var certPath, keyPath string
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(cert_path,''), COALESCE(key_path,'') FROM ssl_certificates WHERE id=$1 AND organization_id=$2`,
		id, orgID).Scan(&certPath, &keyPath)

	ct, err := s.db.Exec(ctx, `DELETE FROM ssl_certificates WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrCertNotFound
	}

	// Best-effort cleanup of cert files
	if certPath != "" { _ = os.Remove(certPath) }
	if keyPath != "" { _ = os.Remove(keyPath) }

	return nil
}
