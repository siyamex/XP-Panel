-- +goose Up
CREATE TABLE database_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(64) NOT NULL,
    db_type VARCHAR(20) NOT NULL CHECK (db_type IN ('mysql', 'postgresql')),
    db_name VARCHAR(64) NOT NULL,
    host VARCHAR(255) NOT NULL DEFAULT 'localhost',
    port INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'error')),
    size_mb BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_databases_org ON database_instances(organization_id);
CREATE INDEX idx_databases_name ON database_instances(name);

-- +goose Down
DROP TABLE IF EXISTS database_instances;
