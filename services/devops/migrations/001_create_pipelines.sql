-- +goose Up
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  repo_url TEXT,
  branch VARCHAR(100) NOT NULL DEFAULT 'main',
  trigger VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','push','schedule')),
  steps JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','success','failed','cancelled')),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pipelines_org ON pipelines(organization_id);

CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','cancelled')),
  triggered_by VARCHAR(100),
  commit_sha VARCHAR(40),
  commit_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_seconds INT,
  step_results JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_runs_pipeline ON pipeline_runs(pipeline_id);

CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pipeline_id UUID REFERENCES pipelines(id),
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','success','failed','rolled_back')),
  version VARCHAR(100),
  deployed_by VARCHAR(255),
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX idx_deployments_org ON deployments(organization_id);

-- +goose Down
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS pipeline_runs;
DROP TABLE IF EXISTS pipelines;
