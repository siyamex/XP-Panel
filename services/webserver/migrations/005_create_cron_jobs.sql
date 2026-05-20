-- +goose Up
CREATE TABLE cron_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  user_id      UUID NOT NULL,
  domain       VARCHAR(255),
  label        VARCHAR(255) NOT NULL,
  command      TEXT NOT NULL,
  schedule     VARCHAR(100) NOT NULL,
  minute       VARCHAR(20) NOT NULL DEFAULT '*',
  hour         VARCHAR(20) NOT NULL DEFAULT '*',
  day_month    VARCHAR(20) NOT NULL DEFAULT '*',
  month        VARCHAR(20) NOT NULL DEFAULT '*',
  day_week     VARCHAR(20) NOT NULL DEFAULT '*',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at  TIMESTAMPTZ,
  last_status  VARCHAR(10),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cron_jobs_org ON cron_jobs(org_id);
CREATE INDEX idx_cron_jobs_user ON cron_jobs(user_id);

-- +goose Down
DROP TABLE IF EXISTS cron_jobs;
