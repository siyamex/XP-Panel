-- +goose Up
CREATE TABLE email_forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_local VARCHAR(64) NOT NULL,
  source_domain VARCHAR(253) NOT NULL,
  destinations TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_local, source_domain)
);

CREATE INDEX idx_forwarders_org ON email_forwarders(organization_id);

CREATE TRIGGER trg_forwarders_updated_at
  BEFORE UPDATE ON email_forwarders
  FOR EACH ROW EXECUTE FUNCTION update_mail_updated_at();

-- +goose Down
DROP TABLE IF EXISTS email_forwarders;
