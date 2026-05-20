-- +goose Up
CREATE TABLE notifications (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL,
  user_id         UUID,
  type            VARCHAR(50)   NOT NULL DEFAULT 'info'
                  CHECK (type IN ('info','warning','error','success','alert','backup','security','billing')),
  title           VARCHAR(255)  NOT NULL,
  message         TEXT          NOT NULL,
  link            TEXT,
  read            BOOLEAN       NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(organization_id, read) WHERE read=FALSE;

CREATE TABLE notification_preferences (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID          NOT NULL,
  user_id          UUID          NOT NULL,
  email_enabled    BOOLEAN       NOT NULL DEFAULT TRUE,
  slack_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
  slack_webhook    TEXT,
  telegram_chat_id VARCHAR(100),
  alerts_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
  backups_enabled  BOOLEAN       NOT NULL DEFAULT TRUE,
  security_enabled BOOLEAN       NOT NULL DEFAULT TRUE,
  billing_enabled  BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS notifications;
