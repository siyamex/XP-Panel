-- +goose Up
CREATE TABLE mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  domain_id UUID,
  local_part VARCHAR(64) NOT NULL,
  domain VARCHAR(253) NOT NULL,
  password_hash TEXT NOT NULL,
  quota_mb INT NOT NULL DEFAULT 1024,
  used_mb INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(local_part, domain)
);

CREATE INDEX idx_mailboxes_org ON mailboxes(organization_id);
CREATE INDEX idx_mailboxes_domain ON mailboxes(domain);

CREATE OR REPLACE FUNCTION update_mail_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mailboxes_updated_at
  BEFORE UPDATE ON mailboxes
  FOR EACH ROW EXECUTE FUNCTION update_mail_updated_at();

-- +goose Down
DROP TABLE IF EXISTS mailboxes;
