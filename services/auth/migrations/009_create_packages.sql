-- +goose Up
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_domains INT NOT NULL DEFAULT 1,
  max_subdomains INT NOT NULL DEFAULT 10,
  max_mailboxes INT NOT NULL DEFAULT 5,
  max_databases INT NOT NULL DEFAULT 3,
  disk_quota_mb INT NOT NULL DEFAULT 5120,
  bandwidth_quota_mb INT NOT NULL DEFAULT 102400,
  php_versions TEXT[] NOT NULL DEFAULT '{"8.3"}',
  features JSONB NOT NULL DEFAULT '{}',
  is_reseller BOOLEAN NOT NULL DEFAULT FALSE,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packages_org ON packages(organization_id);

CREATE TRIGGER trg_packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- +goose Down
DROP TABLE IF EXISTS packages;
