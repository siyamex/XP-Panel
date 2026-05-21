-- XP-Panel Development Seed Data
-- Run with:
--   docker compose exec postgres psql -U xppanel xppanel < scripts/seed.sql
-- Or locally:
--   psql -U xppanel -d xppanel -f scripts/seed.sql
--
-- Login credentials after seeding:
--   admin@demo.local  / Password123!   (admin role)
--   reseller@demo.local / Password123! (reseller role)
--   user@demo.local  / Password123!   (user role)
--
-- Password hash: argon2id(Password123!) m=65536 t=3 p=4
-- Computed with: pip install argon2-cffi && python scripts/hashpw.py Password123!

BEGIN;

-- ─── Organization ────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, slug, status, settings) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Hosting Co', 'demo', 'active',
   '{"max_domains":100,"max_mailboxes":500,"disk_quota_gb":500}')
ON CONFLICT (slug) DO NOTHING;

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Password for all demo users: Password123!
-- Hash: argon2id m=65536 t=3 p=4, salt=6164643265363665386632346633

INSERT INTO users (id, organization_id, email, email_verified, username,
                   password_hash, first_name, last_name, status)
VALUES
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'admin@demo.local', TRUE, 'admin',
   '6164643265363665386632346633$b464c44f6c072b9e94f4e2a9acf1fbb81dc2078b5307616e05fa882fec1dcd51',
   'Admin', 'User', 'active'),

  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'reseller@demo.local', TRUE, 'reseller1',
   '6164643265363665386632346633$b464c44f6c072b9e94f4e2a9acf1fbb81dc2078b5307616e05fa882fec1dcd51',
   'Jane', 'Reseller', 'active'),

  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   'user@demo.local', TRUE, 'john_doe',
   '6164643265363665386632346633$b464c44f6c072b9e94f4e2a9acf1fbb81dc2078b5307616e05fa882fec1dcd51',
   'John', 'Doe', 'active')
ON CONFLICT (email) DO NOTHING;

-- Assign system roles
INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM roles WHERE name='admin' AND organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000011', id
FROM roles WHERE name='reseller' AND organization_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000012', id
FROM roles WHERE name='user' AND organization_id IS NULL
ON CONFLICT DO NOTHING;

-- Set org owner
UPDATE organizations
SET owner_id = '00000000-0000-0000-0000-000000000010'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND owner_id IS NULL;

-- ─── Servers ─────────────────────────────────────────────────────────────────

INSERT INTO servers (id, organization_id, hostname, ip_address, datacenter,
                     latitude, longitude, os_type, os_version, agent_version, status, specs)
VALUES
  ('00000000-0000-0000-0000-000000000020',
   '00000000-0000-0000-0000-000000000001',
   'web01.demo.local', '192.168.1.10',
   'US-East (New York)', 40.7128, -74.0060,
   'Ubuntu', '24.04 LTS', '1.0.0', 'active',
   '{"cpu_cores":8,"ram_gb":32,"disk_gb":500,"bandwidth_tb":10}'),

  ('00000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-000000000001',
   'web02.demo.local', '192.168.1.11',
   'EU-West (Frankfurt)', 50.1109, 8.6821,
   'Debian', '12 (Bookworm)', '1.0.0', 'active',
   '{"cpu_cores":4,"ram_gb":16,"disk_gb":250,"bandwidth_tb":5}')
ON CONFLICT DO NOTHING;

-- ─── Domains ─────────────────────────────────────────────────────────────────

INSERT INTO domains (id, organization_id, user_id, server_id, name,
                     document_root, status, ssl_enabled, webserver_type, php_version)
VALUES
  ('00000000-0000-0000-0000-000000000030',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000020',
   'example.com',
   '/var/www/example.com/public_html', 'active', TRUE, 'nginx', '8.3'),

  ('00000000-0000-0000-0000-000000000031',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000020',
   'myblog.io',
   '/var/www/myblog.io/public_html', 'active', TRUE, 'nginx', '8.2'),

  ('00000000-0000-0000-0000-000000000032',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000021',
   'store.example.com',
   '/var/www/store.example.com/public_html', 'active', FALSE, 'apache', '8.1')
ON CONFLICT DO NOTHING;

-- ─── SSL Certificates ─────────────────────────────────────────────────────────

INSERT INTO ssl_certificates (id, organization_id, domain, san_domains, issuer,
                               expires_at, auto_renew, provider, status)
VALUES
  ('00000000-0000-0000-0000-000000000040',
   '00000000-0000-0000-0000-000000000001',
   'example.com',
   ARRAY['www.example.com','api.example.com'],
   'Let''s Encrypt Authority X3',
   NOW() + INTERVAL '75 days', TRUE, 'letsencrypt', 'active'),

  ('00000000-0000-0000-0000-000000000041',
   '00000000-0000-0000-0000-000000000001',
   'myblog.io',
   ARRAY['www.myblog.io'],
   'Let''s Encrypt Authority X3',
   NOW() + INTERVAL '12 days', TRUE, 'letsencrypt', 'active'),

  ('00000000-0000-0000-0000-000000000042',
   '00000000-0000-0000-0000-000000000001',
   'expired.example.com',
   ARRAY[]::text[],
   'Let''s Encrypt Authority X3',
   NOW() - INTERVAL '5 days', FALSE, 'letsencrypt', 'expired')
ON CONFLICT DO NOTHING;

-- ─── Alert Rules ──────────────────────────────────────────────────────────────

INSERT INTO alert_rules (id, organization_id, server_id, name, metric,
                          condition, threshold, duration_seconds, severity, channels, enabled)
VALUES
  ('00000000-0000-0000-0000-000000000060',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   'High CPU Usage', 'cpu_percent', 'gt', 85, 300, 'warning',
   '[{"type":"email","target":"admin@demo.local"}]', TRUE),

  ('00000000-0000-0000-0000-000000000061',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   'Critical CPU', 'cpu_percent', 'gt', 95, 60, 'critical',
   '[{"type":"email","target":"admin@demo.local"}]', TRUE),

  ('00000000-0000-0000-0000-000000000062',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   'Low Disk Space', 'disk_percent', 'gt', 80, 600, 'warning',
   '[{"type":"email","target":"admin@demo.local"}]', TRUE),

  ('00000000-0000-0000-0000-000000000063',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000020',
   'Memory Critical', 'ram_percent', 'gt', 90, 120, 'critical',
   '[{"type":"email","target":"admin@demo.local"}]', TRUE)
ON CONFLICT DO NOTHING;

-- ─── Backups ──────────────────────────────────────────────────────────────────

INSERT INTO backups (id, organization_id, type, status, size_bytes, storage_path, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000070',
   '00000000-0000-0000-0000-000000000001',
   'full', 'completed', 524288000,
   's3://xppanel-backups/demo/example.com/2026-05-21-full.tar.gz',
   NOW() - INTERVAL '1 day'),

  ('00000000-0000-0000-0000-000000000071',
   '00000000-0000-0000-0000-000000000001',
   'incremental', 'completed', 10485760,
   's3://xppanel-backups/demo/myblog.io/2026-05-22-incr.tar.gz',
   NOW() - INTERVAL '6 hours'),

  ('00000000-0000-0000-0000-000000000072',
   '00000000-0000-0000-0000-000000000001',
   'database', 'completed', 5242880,
   's3://xppanel-backups/demo/db/2026-05-22-postgres.sql.gz',
   NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

-- ─── Billing Plans + Subscription ────────────────────────────────────────────

INSERT INTO billing_plans (id, name, slug, price_monthly, price_yearly,
                            max_domains, max_mailboxes, disk_quota_gb, bandwidth_tb,
                            features, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000080',
   'Starter', 'starter', 9.99, 99.99, 5, 25, 50, 1,
   '["ssl","backups","monitoring","dns"]', TRUE),

  ('00000000-0000-0000-0000-000000000081',
   'Professional', 'professional', 29.99, 299.99, 25, 200, 250, 5,
   '["ssl","backups","monitoring","dns","devops","ai"]', TRUE),

  ('00000000-0000-0000-0000-000000000082',
   'Enterprise', 'enterprise', 99.99, 999.99, 100, 1000, 1000, 20,
   '["ssl","backups","monitoring","dns","devops","ai","docker","marketplace","sla"]', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO subscriptions (id, organization_id, plan_id, status,
                            current_period_start, current_period_end,
                            stripe_subscription_id)
SELECT
  '00000000-0000-0000-0000-000000000090',
  '00000000-0000-0000-0000-000000000001',
  id,
  'active',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  'sub_demo_professional_123'
FROM billing_plans WHERE slug='professional'
ON CONFLICT DO NOTHING;

-- ─── Docker Containers ────────────────────────────────────────────────────────

INSERT INTO docker_containers (id, organization_id, container_id, name,
                                image, status, ports)
VALUES
  ('00000000-0000-0000-0000-0000000000c0',
   '00000000-0000-0000-0000-000000000001',
   'abc123def456abc1', 'nginx-proxy',
   'nginx:alpine', 'running',
   '[{"host":80,"container":80,"protocol":"tcp"},{"host":443,"container":443,"protocol":"tcp"}]'),

  ('00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-000000000001',
   'bcd234ef5678bcd2', 'redis-cache',
   'redis:7-alpine', 'running',
   '[{"host":6379,"container":6379,"protocol":"tcp"}]'),

  ('00000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-000000000001',
   'cde345f06789cde3', 'mysql-db',
   'mysql:8.0', 'exited',
   '[{"host":3306,"container":3306,"protocol":"tcp"}]')
ON CONFLICT DO NOTHING;

-- ─── Docker Compose Project ───────────────────────────────────────────────────

INSERT INTO docker_compose_projects (id, organization_id, name, compose_file, status)
VALUES
  ('00000000-0000-0000-0000-0000000000d0',
   '00000000-0000-0000-0000-000000000001',
   'wordpress-stack',
   'version: "3.9"
services:
  wordpress:
    image: wordpress:latest
    ports:
      - "8090:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: secret
  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: secret
      MYSQL_RANDOM_ROOT_PASSWORD: "1"',
   'running')
ON CONFLICT DO NOTHING;

-- ─── Notifications ────────────────────────────────────────────────────────────

INSERT INTO notifications (id, organization_id, user_id, type, title, message, read, created_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a0',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'warning', 'SSL Certificate Expiring Soon',
   'myblog.io SSL certificate expires in 12 days. Auto-renewal is enabled.',
   FALSE, NOW() - INTERVAL '1 hour'),

  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'success', 'Backup Completed',
   'Full backup of example.com completed (500 MB).',
   FALSE, NOW() - INTERVAL '23 hours'),

  ('00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'alert', 'High CPU Alert',
   'Server web01 CPU usage exceeded 85% for 5 minutes.',
   TRUE, NOW() - INTERVAL '2 days'),

  ('00000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'info', 'Domain Added',
   'Domain store.example.com has been successfully configured.',
   TRUE, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ─── Marketplace App Installations ───────────────────────────────────────────

INSERT INTO app_installations
  (id, organization_id, app_id, domain_id, install_path, status, config, admin_url, created_at)
SELECT
  '00000000-0000-0000-0000-0000000000b0',
  '00000000-0000-0000-0000-000000000001',
  id,
  '00000000-0000-0000-0000-000000000031',
  '/var/www/myblog.io/public_html',
  'active',
  '{"db_name":"myblog_wp","db_user":"myblog_wp","php_version":"8.2","admin_user":"admin"}',
  'https://myblog.io/wp-admin',
  NOW() - INTERVAL '7 days'
FROM marketplace_apps WHERE slug='wordpress'
ON CONFLICT DO NOTHING;

COMMIT;

-- ─── Verify ───────────────────────────────────────────────────────────────────
\echo ''
\echo '=== Seed data verification ==='
SELECT 'organizations' AS table_name, COUNT(*) AS rows FROM organizations
UNION ALL SELECT 'servers',           COUNT(*) FROM servers
UNION ALL SELECT 'domains',           COUNT(*) FROM domains
UNION ALL SELECT 'ssl_certificates',  COUNT(*) FROM ssl_certificates
UNION ALL SELECT 'alert_rules',       COUNT(*) FROM alert_rules
UNION ALL SELECT 'backups',           COUNT(*) FROM backups
UNION ALL SELECT 'billing_plans',     COUNT(*) FROM billing_plans
UNION ALL SELECT 'docker_containers', COUNT(*) FROM docker_containers
UNION ALL SELECT 'notifications',     COUNT(*) FROM notifications
UNION ALL SELECT 'marketplace_apps',  COUNT(*) FROM marketplace_apps
ORDER BY table_name;
