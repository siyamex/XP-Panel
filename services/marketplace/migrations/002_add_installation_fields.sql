-- +goose Up
ALTER TABLE app_installations
  ADD COLUMN IF NOT EXISTS admin_url     TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS notes         TEXT;

-- +goose Down
ALTER TABLE app_installations
  DROP COLUMN IF EXISTS admin_url,
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS notes;
