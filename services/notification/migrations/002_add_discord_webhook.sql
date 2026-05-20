-- +goose Up
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS discord_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS discord_webhook  TEXT,
  ADD COLUMN IF NOT EXISTS webhook_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS webhook_url      TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret   TEXT;

-- +goose Down
ALTER TABLE notification_preferences
  DROP COLUMN IF EXISTS discord_enabled,
  DROP COLUMN IF EXISTS discord_webhook,
  DROP COLUMN IF EXISTS webhook_enabled,
  DROP COLUMN IF EXISTS webhook_url,
  DROP COLUMN IF EXISTS webhook_secret;
