-- +goose Up
CREATE TABLE IF NOT EXISTS remediation_log (
  id             BIGSERIAL    PRIMARY KEY,
  rule_id        UUID,
  server_id      UUID,
  action_type    VARCHAR(50)  NOT NULL,
  action_params  JSONB        NOT NULL DEFAULT '{}',
  status         VARCHAR(20)  NOT NULL CHECK (status IN ('success','failed')),
  error_message  TEXT,
  executed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_remediation_log_rule ON remediation_log(rule_id, executed_at DESC);

-- +goose Down
DROP TABLE IF EXISTS remediation_log;
