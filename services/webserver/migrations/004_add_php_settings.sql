-- +goose Up
ALTER TABLE vhosts ADD COLUMN IF NOT EXISTS php_settings JSONB;

-- +goose Down
ALTER TABLE vhosts DROP COLUMN IF EXISTS php_settings;
