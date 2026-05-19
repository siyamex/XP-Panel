-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organizations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(255) NOT NULL,
  slug               VARCHAR(100) UNIQUE NOT NULL,
  owner_id           UUID,
  plan_id            UUID,
  white_label_domain VARCHAR(255),
  logo_url           TEXT,
  status             VARCHAR(20)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','suspended','trial','cancelled')),
  settings           JSONB        NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);

-- Trigger: auto-update updated_at
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS organizations CASCADE;
DROP FUNCTION IF EXISTS trigger_set_updated_at CASCADE;
