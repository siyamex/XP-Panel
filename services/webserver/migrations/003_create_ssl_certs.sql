-- +goose Up
CREATE TABLE ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  domain VARCHAR(253) NOT NULL,
  san_domains TEXT[] NOT NULL DEFAULT '{}',
  issuer VARCHAR(255),
  subject VARCHAR(255),
  cert_pem TEXT,
  chain_pem TEXT,
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  provider VARCHAR(20) NOT NULL DEFAULT 'letsencrypt'
    CHECK (provider IN ('letsencrypt', 'zerossl', 'custom')),
  challenge_type VARCHAR(20) NOT NULL DEFAULT 'http'
    CHECK (challenge_type IN ('http', 'dns', 'tls-alpn')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ssl_certs_org ON ssl_certificates(organization_id);
CREATE INDEX idx_ssl_certs_domain ON ssl_certificates(domain);

CREATE TRIGGER trg_ssl_certs_updated_at
  BEFORE UPDATE ON ssl_certificates
  FOR EACH ROW EXECUTE FUNCTION update_webserver_updated_at();

-- +goose Down
DROP TABLE IF EXISTS ssl_certificates;
