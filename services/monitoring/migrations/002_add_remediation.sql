-- +goose Up
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS remediation JSONB;

CREATE TABLE remediation_logs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID         NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    organization_id UUID         NOT NULL,
    action          VARCHAR(50)  NOT NULL,
    target          VARCHAR(255),
    status          VARCHAR(20)  NOT NULL DEFAULT 'success'
                    CHECK (status IN ('success', 'failed', 'skipped')),
    output          TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_remediation_logs_incident ON remediation_logs(incident_id);

-- +goose Down
DROP TABLE IF EXISTS remediation_logs;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS remediation;
