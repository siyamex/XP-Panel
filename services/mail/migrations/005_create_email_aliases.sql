-- +goose Up
CREATE TABLE IF NOT EXISTS email_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source          VARCHAR(320) NOT NULL,   -- e.g. info@example.com or @example.com for catch-all
  destination     VARCHAR(320) NOT NULL,   -- forwarding target
  catch_all       BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, source)
);
CREATE INDEX IF NOT EXISTS idx_email_aliases_org ON email_aliases(organization_id);

-- +goose Down
DROP TABLE IF EXISTS email_aliases;
