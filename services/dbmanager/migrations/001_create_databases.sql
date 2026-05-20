-- +goose Up
CREATE TABLE IF NOT EXISTS database_instances (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL,
  name            VARCHAR(100)  NOT NULL,
  db_type         VARCHAR(20)   NOT NULL DEFAULT 'postgresql'
                  CHECK (db_type IN ('postgresql','mysql','mariadb')),
  db_name         VARCHAR(100)  NOT NULL,
  host            VARCHAR(255)  NOT NULL DEFAULT 'localhost',
  port            INT           NOT NULL DEFAULT 5432,
  status          VARCHAR(20)   NOT NULL DEFAULT 'active',
  size_mb         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS database_users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL,
  database_id     UUID          REFERENCES database_instances(id) ON DELETE CASCADE,
  username        VARCHAR(100)  NOT NULL,
  privileges      JSONB         NOT NULL DEFAULT '["SELECT"]',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, username)
);

CREATE INDEX IF NOT EXISTS idx_db_instances_org ON database_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_db_users_org ON database_users(organization_id);

-- +goose Down
DROP TABLE IF EXISTS database_users;
DROP TABLE IF EXISTS database_instances;
