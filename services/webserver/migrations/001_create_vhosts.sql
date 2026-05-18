-- +goose Up
CREATE TABLE vhosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  domain_name VARCHAR(253) NOT NULL UNIQUE,
  document_root TEXT NOT NULL DEFAULT '/var/www/html',
  server_type VARCHAR(20) NOT NULL DEFAULT 'nginx'
    CHECK (server_type IN ('nginx', 'apache', 'caddy', 'litespeed')),
  php_version VARCHAR(10),
  ssl_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ssl_cert_id UUID,
  access_log TEXT,
  error_log TEXT,
  custom_config TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vhosts_org ON vhosts(organization_id);

CREATE OR REPLACE FUNCTION update_webserver_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vhosts_updated_at
  BEFORE UPDATE ON vhosts
  FOR EACH ROW EXECUTE FUNCTION update_webserver_updated_at();

-- +goose Down
DROP TABLE IF EXISTS vhosts;
