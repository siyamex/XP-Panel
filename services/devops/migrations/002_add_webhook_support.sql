-- +goose Up
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS trigger_metadata JSONB;

-- +goose Down
ALTER TABLE pipelines DROP COLUMN IF EXISTS webhook_secret;
ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS trigger_metadata;
