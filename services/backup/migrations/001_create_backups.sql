-- +goose Up
CREATE TABLE backup_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('s3', 'local', 'backblaze')),
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    cron_expr VARCHAR(50) NOT NULL,
    destination_id UUID REFERENCES backup_destinations(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (type IN ('full', 'incremental', 'database', 'files')),
    retain_count INT NOT NULL DEFAULT 7,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    schedule_id UUID REFERENCES backup_schedules(id) ON DELETE SET NULL,
    destination_id UUID REFERENCES backup_destinations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental', 'database', 'files')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT,
    encrypted BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_backups_org ON backups(organization_id);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_created ON backups(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS backups;
DROP TABLE IF EXISTS backup_schedules;
DROP TABLE IF EXISTS backup_destinations;
