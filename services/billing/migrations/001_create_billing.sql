-- +goose Up
CREATE TABLE billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  stripe_price_id_monthly VARCHAR(100),
  stripe_price_id_yearly VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_plans (name, slug, price_monthly, price_yearly, features, limits) VALUES
  ('Starter', 'starter', 9.00, 86.00, '{"domains":5,"email":true,"ssl":true}', '{"domains":5,"disk_gb":20,"bandwidth_gb":100}'),
  ('Pro', 'pro', 29.00, 278.00, '{"domains":25,"email":true,"ssl":true,"backups":true,"monitoring":true}', '{"domains":25,"disk_gb":100,"bandwidth_gb":500}'),
  ('Business', 'business', 79.00, 758.00, '{"domains":100,"email":true,"ssl":true,"backups":true,"monitoring":true,"docker":true,"devops":true}', '{"domains":100,"disk_gb":500,"bandwidth_gb":2000}'),
  ('Enterprise', 'enterprise', 199.00, 1910.00, '{"domains":-1,"email":true,"ssl":true,"backups":true,"monitoring":true,"docker":true,"devops":true,"ai":true,"reseller":true}', '{"domains":-1,"disk_gb":-1,"bandwidth_gb":-1}');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  plan_id UUID NOT NULL REFERENCES billing_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','trialing','paused')),
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  stripe_subscription_id VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id VARCHAR(100),
  number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoices_org ON invoices(organization_id);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric VARCHAR(50) NOT NULL,
  value DECIMAL(15,3) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS usage_records;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS billing_plans;
