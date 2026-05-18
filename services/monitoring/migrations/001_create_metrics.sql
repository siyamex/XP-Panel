-- +goose Up
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    server_id UUID,
    name VARCHAR(100) NOT NULL,
    metric VARCHAR(50) NOT NULL,
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('gt', 'lt', 'gte', 'lte', 'eq')),
    threshold DECIMAL NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 60,
    severity VARCHAR(10) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    channels JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_rules_org ON alert_rules(organization_id);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    server_id UUID,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    severity VARCHAR(10) NOT NULL DEFAULT 'warning',
    metric VARCHAR(50),
    value DECIMAL,
    threshold DECIMAL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ
);
CREATE INDEX idx_incidents_org ON incidents(organization_id);
CREATE INDEX idx_incidents_status ON incidents(status);

-- +goose Down
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS alert_rules;
