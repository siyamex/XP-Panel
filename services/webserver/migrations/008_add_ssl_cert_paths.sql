-- +goose Up
ALTER TABLE ssl_certificates
  ADD COLUMN IF NOT EXISTS cert_path TEXT,
  ADD COLUMN IF NOT EXISTS key_path  TEXT;

ALTER TABLE vhosts
  ADD COLUMN IF NOT EXISTS ssl_cert_path TEXT,
  ADD COLUMN IF NOT EXISTS ssl_key_path  TEXT;

-- +goose Down
ALTER TABLE ssl_certificates DROP COLUMN IF EXISTS cert_path, DROP COLUMN IF EXISTS key_path;
ALTER TABLE vhosts DROP COLUMN IF EXISTS ssl_cert_path, DROP COLUMN IF EXISTS ssl_key_path;
