-- +goose Up
CREATE TABLE IF NOT EXISTS dkim_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  domain VARCHAR(253) NOT NULL UNIQUE,
  selector VARCHAR(63) NOT NULL DEFAULT 'default',
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  dns_txt_value TEXT NOT NULL,
  key_size INT NOT NULL DEFAULT 2048,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dkim_keys_org ON dkim_keys(organization_id);

-- +goose Down
DROP TABLE IF EXISTS dkim_keys;
