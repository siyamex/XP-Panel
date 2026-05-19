-- +goose Up
CREATE TABLE php_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vhost_id UUID NOT NULL REFERENCES vhosts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  php_version VARCHAR(10) NOT NULL DEFAULT '8.3',
  memory_limit VARCHAR(20) NOT NULL DEFAULT '256M',
  max_execution_time INT NOT NULL DEFAULT 300,
  upload_max_filesize VARCHAR(20) NOT NULL DEFAULT '64M',
  post_max_size VARCHAR(20) NOT NULL DEFAULT '64M',
  max_input_vars INT NOT NULL DEFAULT 3000,
  opcache_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  extensions TEXT[] NOT NULL DEFAULT '{}',
  extra_ini TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_php_configs_vhost ON php_configs(vhost_id);


-- +goose Down
DROP TABLE IF EXISTS php_configs;
