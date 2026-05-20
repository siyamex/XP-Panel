-- +goose Up
CREATE TABLE IF NOT EXISTS pipeline_run_logs (
  id          BIGSERIAL PRIMARY KEY,
  run_id      UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_name   TEXT NOT NULL,
  log_line    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_run_logs_run ON pipeline_run_logs(run_id, created_at);

-- +goose Down
DROP TABLE IF EXISTS pipeline_run_logs;
