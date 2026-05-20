-- +goose Up
CREATE TABLE subdomains (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  domain       VARCHAR(255) NOT NULL,
  subdomain    VARCHAR(100) NOT NULL,
  document_root TEXT NOT NULL,
  redirect_to  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, subdomain)
);

CREATE TABLE domain_redirects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  domain       VARCHAR(255) NOT NULL,
  source_path  VARCHAR(500) NOT NULL DEFAULT '/',
  destination  TEXT NOT NULL,
  type         SMALLINT NOT NULL DEFAULT 301 CHECK (type IN (301, 302)),
  wildcard     BOOLEAN NOT NULL DEFAULT FALSE,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE domain_error_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  domain       VARCHAR(255) NOT NULL,
  error_code   SMALLINT NOT NULL,
  html_content TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, error_code)
);

CREATE TABLE directory_privacy (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  domain       VARCHAR(255) NOT NULL,
  path         TEXT NOT NULL,
  realm        VARCHAR(255) NOT NULL DEFAULT 'Protected Area',
  htpasswd     TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, path)
);

CREATE TABLE ssh_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  user_id      UUID NOT NULL,
  label        VARCHAR(255) NOT NULL,
  public_key   TEXT NOT NULL,
  fingerprint  VARCHAR(100) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ssh_keys_user ON ssh_keys(user_id);

CREATE TABLE mysql_remote_access (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL,
  ip_address   INET NOT NULL,
  label        VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, ip_address)
);

-- +goose Down
DROP TABLE IF EXISTS mysql_remote_access;
DROP TABLE IF EXISTS ssh_keys;
DROP TABLE IF EXISTS directory_privacy;
DROP TABLE IF EXISTS domain_error_pages;
DROP TABLE IF EXISTS domain_redirects;
DROP TABLE IF EXISTS subdomains;
