-- +goose Up
CREATE TABLE IF NOT EXISTS vhosts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  domain_name     VARCHAR(253) NOT NULL,
  server_type     VARCHAR(20)  NOT NULL DEFAULT 'nginx'
                  CHECK (server_type IN ('nginx','apache','caddy','litespeed','openlitespeed')),
  document_root   TEXT        NOT NULL,
  php_version     VARCHAR(10),
  ssl_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  ssl_cert_path   TEXT,
  ssl_key_path    TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','error')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, domain_name)
);
CREATE INDEX IF NOT EXISTS idx_vhosts_org ON vhosts(organization_id);

CREATE TABLE IF NOT EXISTS ssl_certificates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  domain          VARCHAR(253) NOT NULL,
  provider        VARCHAR(50)  NOT NULL DEFAULT 'letsencrypt',
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','expired','failed')),
  cert_pem        TEXT,
  key_pem         TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_ssl_org ON ssl_certificates(organization_id);

-- +goose Down
DROP TABLE IF EXISTS ssl_certificates;
DROP TABLE IF EXISTS vhosts;
