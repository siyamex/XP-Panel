-- +goose Up
CREATE TABLE roles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(50)  NOT NULL,
  is_system       BOOLEAN     NOT NULL DEFAULT FALSE,
  permissions     JSONB        NOT NULL DEFAULT '[]',
  UNIQUE(organization_id, name)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_roles_org ON roles(organization_id);

-- Seed system roles (organization_id = NULL means global)
INSERT INTO roles (id, organization_id, name, is_system, permissions) VALUES
  (gen_random_uuid(), NULL, 'super_admin', TRUE, '["super:*"]'),
  (gen_random_uuid(), NULL, 'admin', TRUE, '[
    "domains:read","domains:write","domains:delete",
    "dns:read","dns:write",
    "mail:read","mail:write",
    "files:read","files:write",
    "db:read","db:write",
    "backup:read","backup:write","backup:restore",
    "security:read","security:write",
    "monitoring:read","monitoring:write",
    "billing:read","billing:write",
    "devops:read","devops:write",
    "docker:read","docker:write",
    "ai:use",
    "marketplace:read","marketplace:install",
    "admin:users","admin:servers"
  ]'),
  (gen_random_uuid(), NULL, 'reseller', TRUE, '[
    "domains:read","domains:write",
    "dns:read","dns:write",
    "mail:read","mail:write",
    "db:read","db:write",
    "backup:read","backup:write",
    "monitoring:read",
    "billing:read","billing:write",
    "ai:use",
    "marketplace:read","marketplace:install",
    "admin:users"
  ]'),
  (gen_random_uuid(), NULL, 'user', TRUE, '[
    "domains:read","domains:write",
    "dns:read","dns:write",
    "mail:read","mail:write",
    "files:read","files:write",
    "db:read","db:write",
    "backup:read","backup:write","backup:restore",
    "monitoring:read",
    "billing:read",
    "ai:use",
    "marketplace:read","marketplace:install"
  ]'),
  (gen_random_uuid(), NULL, 'developer', TRUE, '[
    "domains:read","domains:write",
    "dns:read","dns:write",
    "mail:read","mail:write",
    "files:read","files:write",
    "db:read","db:write",
    "backup:read","backup:write","backup:restore",
    "monitoring:read",
    "billing:read",
    "devops:read","devops:write",
    "docker:read","docker:write",
    "ai:use",
    "marketplace:read","marketplace:install"
  ]'),
  (gen_random_uuid(), NULL, 'auditor', TRUE, '[
    "domains:read","dns:read","mail:read",
    "db:read","backup:read","security:read",
    "monitoring:read","billing:read",
    "devops:read","docker:read","marketplace:read"
  ]');

-- +goose Down
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
