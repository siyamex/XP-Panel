-- +goose Up
CREATE TABLE IF NOT EXISTS geoip_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  country_code    CHAR(2) NOT NULL,
  country_name    VARCHAR(100) NOT NULL DEFAULT '',
  action          VARCHAR(10) NOT NULL DEFAULT 'block' CHECK (action IN ('block','log')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, country_code)
);
CREATE INDEX IF NOT EXISTS idx_geoip_blocks_org ON geoip_blocks(organization_id);

-- +goose Down
DROP TABLE IF EXISTS geoip_blocks;
