-- +goose Up
CREATE TABLE dns_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  domain_id UUID,
  name VARCHAR(253) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'Native'
    CHECK (kind IN ('Native', 'Master', 'Slave')),
  serial BIGINT NOT NULL DEFAULT 1,
  nameservers TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),
  powerdns_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_dns_zones_name ON dns_zones(name);
CREATE INDEX idx_dns_zones_org ON dns_zones(organization_id);

CREATE OR REPLACE FUNCTION update_dns_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dns_zones_updated_at
  BEFORE UPDATE ON dns_zones
  FOR EACH ROW EXECUTE FUNCTION update_dns_zones_updated_at();

-- +goose Down
DROP TABLE IF EXISTS dns_zones;
