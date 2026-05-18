-- +goose Up
CREATE TABLE firewall_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    server_id UUID,
    chain VARCHAR(20) NOT NULL DEFAULT 'INPUT' CHECK (chain IN ('INPUT', 'OUTPUT', 'FORWARD')),
    action VARCHAR(10) NOT NULL CHECK (action IN ('ACCEPT', 'DROP', 'REJECT')),
    protocol VARCHAR(10) CHECK (protocol IN ('tcp', 'udp', 'icmp', 'all')),
    source_ip CIDR,
    dest_ip CIDR,
    port_range VARCHAR(20),
    priority INT NOT NULL DEFAULT 100,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    comment VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_firewall_org ON firewall_rules(organization_id);

CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    server_id UUID,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    source_ip INET,
    source_country CHAR(2),
    target VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}',
    mitigated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sec_events_org ON security_events(organization_id);
CREATE INDEX idx_sec_events_created ON security_events(created_at DESC);

CREATE TABLE ip_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    ip CIDR NOT NULL,
    reason VARCHAR(255),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, ip)
);

-- +goose Down
DROP TABLE IF EXISTS ip_blocklist;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS firewall_rules;
