-- +goose Up
CREATE TABLE docker_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  container_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  image VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'created',
  ports JSONB NOT NULL DEFAULT '[]',
  env JSONB NOT NULL DEFAULT '[]',
  labels JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_docker_containers_org ON docker_containers(organization_id);

CREATE TABLE docker_compose_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  compose_file TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'stopped',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS docker_compose_projects;
DROP TABLE IF EXISTS docker_containers;
