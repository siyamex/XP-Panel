-- +goose Up
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  server_id UUID REFERENCES servers(id),
  package_id UUID REFERENCES packages(id),
  name VARCHAR(253) NOT NULL UNIQUE,
  document_root TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active','suspended','pending','error')),
  ssl_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  webserver_type VARCHAR(20) NOT NULL DEFAULT 'nginx'
    CHECK (webserver_type IN ('nginx','apache','litespeed','openlitespeed','caddy')),
  php_version VARCHAR(10),
  bandwidth_used_mb BIGINT NOT NULL DEFAULT 0,
  disk_used_mb BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domains_org ON domains(organization_id);
CREATE INDEX idx_domains_user ON domains(user_id);
CREATE INDEX idx_domains_name ON domains(name);
CREATE INDEX idx_domains_status ON domains(status);

CREATE TRIGGER trg_domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- +goose Down
DROP TABLE IF EXISTS domains;
