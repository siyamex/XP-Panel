-- +goose Up
CREATE TABLE marketplace_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  icon_url TEXT,
  version VARCHAR(50) NOT NULL,
  author VARCHAR(255),
  homepage TEXT,
  install_count INT NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]',
  requirements JSONB NOT NULL DEFAULT '{}',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO marketplace_apps (slug, name, description, category, version, author, install_count, rating, tags, is_featured) VALUES
  ('wordpress', 'WordPress', 'The world''s most popular CMS. Power 43% of all websites.', 'cms', '6.6.2', 'WordPress Foundation', 15420, 4.8, '["php","mysql","blog","cms"]', TRUE),
  ('laravel', 'Laravel', 'The PHP framework for web artisans. Elegant syntax, powerful features.', 'framework', '11.x', 'Taylor Otwell', 8930, 4.9, '["php","framework","artisan"]', TRUE),
  ('nextjs', 'Next.js', 'The React framework for production. SSR, SSG, API routes and more.', 'framework', '15.x', 'Vercel', 6210, 4.8, '["nodejs","react","ssr"]', TRUE),
  ('ghost', 'Ghost', 'Turn your audience into a business. Professional publishing platform.', 'cms', '5.x', 'Ghost Foundation', 3400, 4.6, '["nodejs","blog","publishing"]', FALSE),
  ('minio', 'MinIO', 'High-performance S3-compatible object storage for cloud-native workloads.', 'storage', 'RELEASE.2024', 'MinIO Inc', 2100, 4.7, '["s3","storage","docker"]', FALSE),
  ('n8n', 'n8n', 'Workflow automation tool. Extendable fair-code licensed node-based tool.', 'automation', '1.x', 'n8n GmbH', 1800, 4.5, '["automation","workflow","nodejs"]', TRUE),
  ('matomo', 'Matomo', 'Google Analytics alternative. Full data ownership.', 'analytics', '5.x', 'Matomo', 1200, 4.4, '["analytics","php","mysql"]', FALSE),
  ('discourse', 'Discourse', 'A platform for community discussion.', 'community', '3.x', 'Discourse Team', 980, 4.6, '["ruby","community","forum"]', FALSE);

CREATE TABLE app_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL REFERENCES marketplace_apps(id),
  domain_id UUID,
  install_path TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'installing' CHECK (status IN ('installing','active','updating','failed','removed')),
  version VARCHAR(50),
  config JSONB NOT NULL DEFAULT '{}',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_installations_org ON app_installations(organization_id);

-- +goose Down
DROP TABLE IF EXISTS app_installations;
DROP TABLE IF EXISTS marketplace_apps;
