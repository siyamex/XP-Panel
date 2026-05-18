-- +goose Up
CREATE TABLE users (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email              VARCHAR(255) UNIQUE NOT NULL,
  email_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
  username           VARCHAR(100) UNIQUE NOT NULL,
  password_hash      TEXT,
  first_name         VARCHAR(100),
  last_name          VARCHAR(100),
  status             VARCHAR(20)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('active','suspended','pending','locked')),
  failed_login_count SMALLINT    NOT NULL DEFAULT 0,
  locked_until       TIMESTAMPTZ,
  last_login_at      TIMESTAMPTZ,
  mfa_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
  mfa_type           VARCHAR(20)  CHECK (mfa_type IN ('totp','sms','webauthn')),
  mfa_secret         TEXT,
  passkey_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  timezone           VARCHAR(50)  NOT NULL DEFAULT 'UTC',
  language           VARCHAR(10)  NOT NULL DEFAULT 'en',
  metadata           JSONB        NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS users CASCADE;
