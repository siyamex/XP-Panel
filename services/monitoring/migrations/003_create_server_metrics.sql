-- +goose Up

-- Per-server metric snapshots (Postgres buffer; ClickHouse holds long-term history)
CREATE TABLE server_metrics (
    id             BIGSERIAL    PRIMARY KEY,
    server_id      UUID         NOT NULL,
    collected_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    cpu_percent    REAL         NOT NULL DEFAULT 0,
    ram_percent    REAL         NOT NULL DEFAULT 0,
    ram_total_mb   BIGINT       NOT NULL DEFAULT 0,
    ram_used_mb    BIGINT       NOT NULL DEFAULT 0,
    disk_percent   REAL         NOT NULL DEFAULT 0,
    disk_total_mb  BIGINT       NOT NULL DEFAULT 0,
    disk_used_mb   BIGINT       NOT NULL DEFAULT 0,
    disk_read_mb_s REAL         NOT NULL DEFAULT 0,
    disk_write_mb_s REAL        NOT NULL DEFAULT 0,
    net_in_mb_s    REAL         NOT NULL DEFAULT 0,
    net_out_mb_s   REAL         NOT NULL DEFAULT 0,
    load_avg_1     REAL         NOT NULL DEFAULT 0,
    load_avg_5     REAL         NOT NULL DEFAULT 0,
    load_avg_15    REAL         NOT NULL DEFAULT 0,
    processes      INT          NOT NULL DEFAULT 0,
    uptime         BIGINT       NOT NULL DEFAULT 0,
    forwarded_to_ch BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_server_metrics_server_time ON server_metrics(server_id, collected_at DESC);
CREATE INDEX idx_server_metrics_pending     ON server_metrics(forwarded_to_ch) WHERE forwarded_to_ch = FALSE;

-- Registered agents (one row per monitored server)
CREATE TABLE monitored_servers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID        NOT NULL,
    hostname    VARCHAR(255) NOT NULL,
    ip_address  INET,
    api_key     TEXT        NOT NULL UNIQUE,  -- hashed in production; plaintext for dev
    agent_version VARCHAR(20),
    last_seen_at TIMESTAMPTZ,
    status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','offline','disabled')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_monitored_servers_org ON monitored_servers(org_id);
CREATE INDEX idx_monitored_servers_key ON monitored_servers(api_key);

-- +goose Down
DROP TABLE IF EXISTS server_metrics;
DROP TABLE IF EXISTS monitored_servers;
