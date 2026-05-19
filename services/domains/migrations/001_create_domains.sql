-- +goose Up
CREATE TABLE IF NOT EXISTS domains (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  user_id         UUID        NOT NULL,
  name            VARCHAR(253) NOT NULL UNIQUE,
  document_root   TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','pending','error')),
  ssl_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
  webserver_type  VARCHAR(20)  NOT NULL DEFAULT 'nginx'
                  CHECK (webserver_type IN ('nginx','apache','litespeed','openlitespeed','caddy')),
  php_version     VARCHAR(10),
  bandwidth_used_mb BIGINT     NOT NULL DEFAULT 0,
  disk_used_mb    BIGINT       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domains_org    ON domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_domains_name   ON domains(name);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);

-- +goose Down
DROP TABLE IF EXISTS domains;
