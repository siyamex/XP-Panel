-- +goose Up
CREATE TABLE database_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    database_id UUID NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    privileges TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(database_id, username)
);
CREATE INDEX idx_db_users_db ON database_users(database_id);

-- +goose Down
DROP TABLE IF EXISTS database_users;
