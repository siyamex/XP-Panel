-- +goose Up
CREATE TABLE dkim_keys (
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

CREATE INDEX idx_dkim_keys_org ON dkim_keys(organization_id);

CREATE TRIGGER trg_dkim_keys_updated_at
  BEFORE UPDATE ON dkim_keys
  FOR EACH ROW EXECUTE FUNCTION update_mail_updated_at();

-- +goose Down
DROP TABLE IF EXISTS dkim_keys;
