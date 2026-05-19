-- +goose Up
CREATE TABLE catch_all_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  domain VARCHAR(253) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, domain)
);
CREATE INDEX idx_catch_all_org ON catch_all_addresses(organization_id);
CREATE INDEX idx_catch_all_domain ON catch_all_addresses(domain);

-- +goose Down
DROP TABLE IF EXISTS catch_all_addresses;
