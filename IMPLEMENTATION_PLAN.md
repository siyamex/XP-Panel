# XP-Panel — Implementation Plan

> Generated: 2026-05-20
> Full gap analysis against the target specification.

---

## Status Overview

| # | Feature Area | Status | Notes |
|---|---|---|---|
| 1 | Account Management | ⚠️ | Missing login history UI, device tracking UI, team collaboration |
| 2 | Domain Management | ⚠️ | Missing parked/alias/wildcard/IDN/DNSSEC/WHOIS/health checks |
| 3 | DNS Management | ⚠️ | Missing GeoDNS, templates, failover, analytics, propagation checker |
| 4 | Web Server Management | ⚠️ | Missing HTTP/3, Brotli, caching UI, load balancing, CDN, rate limiting UI |
| 5 | PHP Management | ⚠️ | Missing php.ini editor, OPcache UI, Composer integration |
| 6 | Database Management | ⚠️ | Missing MongoDB/Redis mgmt, replication, query analytics, slow query |
| 7 | Email System | ⚠️ | Missing DMARC, mailing lists, vacation responder, catch-all, webmail |
| 8 | File Management | ⚠️ | Missing Git integration, WebDAV, SFTP, version history, trash |
| 9 | Security System | ⚠️ | Missing WAF/ModSecurity, CrowdSec, GeoIP blocking, rootkit detection |
| 10 | Backup System | ⚠️ | Missing Google Drive, snapshot backups, granular restore, cross-server replication |
| 11 | Monitoring | ⚠️ | Missing Discord alerts, webhook alerts, uptime monitoring, error tracking |
| 12 | Docker/Containers | ⚠️ | Missing snapshots, registry integration, one-click container templates |
| 13 | DevOps | ⚠️ | Missing blue/green, staging env policies, GitHub/GitLab app integration |
| 14 | AI Features | ⚠️ | Missing auto-scaling suggestions, billing anomaly detection |
| 15 | Marketplace | ⚠️ | Missing Laravel/Node.js/Python toolkits, Nextcloud, Ghost CMS |
| 16 | Billing | ⚠️ | Missing PayPal, crypto, auto-suspension, real usage metering |
| 17 | Reseller System | ⚠️ | Missing nested resellers, usage reports API |
| 18 | API and Extensibility | ⚠️ | Missing GraphQL impl, generic webhook dispatcher, SDK gen, CLI |
| 19 | GIS / AltGIS Features | ⚠️ | 2D canvas only — missing CesiumJS 3D globe, Mapbox, BGP/ASN |
| 20 | Enterprise Features | ❌ | Missing multi-server clustering, HA, OpenTelemetry, SIEM, compliance dashboard |
| 21 | Authentication | ⚠️ | OAuth2/WebAuthn handlers missing, LDAP/SSO not built |
| 22 | Installer System | ⚠️ | Missing GUI installer, auto-repair tools |
| 23 | Open Source | ⚠️ | Missing OpenAPI spec, SDK generation, CLI tool |
| 24 | i18n / Accessibility | ❌ | No i18n framework, no RTL support, no Dhivehi, limited ARIA |

---

## P0 — Critical (Production Blockers)

These must be completed before XP-Panel can be used in production.

---

### P0-1: WebAuthn / Passkeys Endpoints

**What exists:** `services/auth/migrations/006_create_passkeys.sql` table created, domain model in `services/auth/internal/domain/`. No HTTP handlers exist.

**Files to create:**
- `services/auth/internal/handler/passkey.go`
- `services/auth/internal/service/passkey_service.go`

**Add to `services/auth/go.mod`:**
```
github.com/go-webauthn/webauthn v0.10.x
```

**Implementation steps:**
1. Add `go-webauthn` dependency: `go get github.com/go-webauthn/webauthn`
2. Create `PasskeyService` struct in `passkey_service.go` with methods:
   - `BeginRegistration(userID string) (*protocol.CredentialCreation, *webauthn.SessionData, error)`
   - `FinishRegistration(userID string, session *webauthn.SessionData, r *http.Request) error`
   - `BeginAuthentication(email string) (*protocol.CredentialAssertion, *webauthn.SessionData, error)`
   - `FinishAuthentication(email string, session *webauthn.SessionData, r *http.Request) (*domain.User, error)`
3. Create `PasskeyHandler` in `passkey.go` with routes:
   - `POST /api/v1/auth/passkey/register/begin` — returns PublicKeyCredentialCreationOptions JSON
   - `POST /api/v1/auth/passkey/register/finish` — verifies attestation, stores credential in passkeys table
   - `POST /api/v1/auth/passkey/authenticate/begin` — returns PublicKeyCredentialRequestOptions JSON
   - `POST /api/v1/auth/passkey/authenticate/finish` — verifies assertion, returns JWT pair
4. Store WebAuthn session data in Redis: key `webauthn:session:{userID}`, TTL 5 minutes
5. Register routes in `services/auth/cmd/auth/main.go`
6. Add passkey proxy routes to `services/gateway/internal/proxy/proxy.go`
7. Frontend: add "Add Passkey" button in `apps/web/src/app/(panel)/settings/security/page.tsx`

**Complexity:** M (3–4 days)

---

### P0-2: OAuth2 Handler Implementation

**What exists:** Gateway has routes `/api/v1/auth/oauth2/:provider` and `/api/v1/auth/oauth2/:provider/callback` registered, but no handler implementation exists in the auth service.

**Files to create:** `services/auth/internal/handler/oauth.go`

**Add to `services/auth/go.mod`:** `golang.org/x/oauth2`

**Implementation steps:**
1. Create `OAuthHandler` struct with providers map: GitHub, Google, GitLab
2. `GET /api/v1/auth/oauth2/:provider`:
   - Build provider auth URL with random state
   - Store state in Redis (key: `oauth:state:{state}`, TTL 10min)
   - Redirect to provider
3. `GET /api/v1/auth/oauth2/:provider/callback`:
   - Verify state from Redis
   - Exchange code for access token
   - Fetch user profile from provider API
   - Upsert user in DB (create on first login, update email/name on subsequent)
   - Issue JWT pair, redirect to frontend with tokens
4. Migration `services/auth/migrations/008_add_oauth.sql`:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20);
   ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_subject VARCHAR(255);
   CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_subject);
   ```
5. Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
6. Frontend: add GitHub/Google OAuth buttons to `apps/web/src/app/(auth)/login/page.tsx`

**Complexity:** M (3–4 days)

---

### P0-3: Real Stripe Integration

**What exists:** `services/billing/internal/handler/billing.go` has webhook endpoint stub that returns 200 without processing. No Stripe SDK used anywhere.

**Add to `services/billing/go.mod`:** `github.com/stripe/stripe-go/v78`

**Implementation steps:**
1. `CreateCheckoutSession` handler:
   - Create/retrieve Stripe Customer (store `stripe_customer_id` in subscriptions table)
   - Create Stripe Subscription for recurring billing or Checkout Session for one-time
   - Return `{session_url: "https://checkout.stripe.com/..."}` for frontend redirect
2. Real webhook handler `POST /api/v1/billing/webhooks/stripe`:
   - Verify `Stripe-Signature` header using `webhook.ConstructEvent()`
   - Handle `invoice.paid`: mark invoice paid, activate subscription
   - Handle `invoice.payment_failed`: set subscription `status=past_due`
   - Handle `customer.subscription.deleted`: set `status=cancelled`
   - Handle `customer.subscription.updated`: sync billing cycle, period dates
3. Migration `services/billing/migrations/002_add_stripe_ids.sql`:
   ```sql
   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);
   ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100);
   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(100);
   ```
4. Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`

**Complexity:** M (3–4 days)

---

### P0-4: Auto-Suspension Worker

**What exists:** Subscriptions can expire/go past_due, but no background process suspends the organization.

**Files to create:** `services/billing/internal/worker/suspension.go`

**Implementation steps:**
1. `SuspensionWorker` struct with `pool *pgxpool.Pool` and `notificationURL string`
2. `Start(ctx context.Context)` runs every hour via `time.NewTicker(time.Hour)`
3. Query: `SELECT s.organization_id FROM subscriptions s WHERE s.status IN ('past_due','cancelled') AND s.current_period_end < NOW()`
4. For each: `UPDATE organizations SET status='suspended', updated_at=NOW() WHERE id=$1 AND status='active'`
5. If rows affected: call `POST {NOTIFICATION_SERVICE_URL}/api/v1/notifications/dispatch` with type=billing, title="Account Suspended"
6. Wire in `services/billing/cmd/billing/main.go`:
   ```go
   go worker.NewSuspensionWorker(pool).Start(ctx)
   ```

**Complexity:** S (1 day)

---

### P0-5: Real Usage Metering

**What exists:** `GetUsageStats` in billing handler returns hardcoded mock struct with fake numbers.

**Files to modify:** `services/billing/internal/handler/billing.go`

**Implementation steps:**
1. Replace mocks with real DB queries (billing service has its own DB pool):
   - `SELECT COUNT(*) FROM domains WHERE organization_id=$1`
   - `SELECT COALESCE(SUM(disk_used_mb),0)/1024 FROM domains WHERE organization_id=$1`
   - `SELECT COALESCE(SUM(bandwidth_used_mb),0)/1024 FROM domains WHERE organization_id=$1`
   - `SELECT COUNT(*) FROM mailboxes WHERE organization_id=$1`
   - `SELECT COUNT(*) FROM database_instances WHERE organization_id=$1`
2. Add Redis caching: key `usage:{orgID}`, TTL 5 minutes, marshal/unmarshal UsageStats JSON
3. Add periodic snapshot worker: every 24h insert row into `usage_records` table

**Complexity:** S (1 day)

---

### P0-6: Login History API + Frontend

**What exists:** `user_sessions` table stores `ip_address`, `user_agent`, `device_fingerprint`, `created_at`, `last_active_at`. No API to list or revoke sessions exists.

**Files to modify:**
- `services/auth/internal/handler/user.go` — add 3 new handlers
- `apps/web/src/app/(panel)/settings/security/page.tsx` — add Sessions tab

**Implementation steps:**
1. `GET /api/v1/auth/sessions` — list current user's sessions ordered by `last_active_at DESC`
2. `DELETE /api/v1/auth/sessions/:id` — revoke single session (delete row)
3. `DELETE /api/v1/auth/sessions` — revoke all sessions except current (identified by token hash)
4. Frontend Sessions tab: table with columns — Device (icon from UA), IP Address, Location, Last Active, Actions (Revoke button)
5. Add `lib/api/auth.api.ts` methods: `listSessions()`, `revokeSession(id)`, `revokeAllSessions()`

**Complexity:** S (1–2 days)

---

## P1 — High Priority

---

### P1-1: LDAP / Active Directory Integration

**Files to create:**
- `services/auth/internal/handler/ldap.go`
- `services/auth/internal/service/ldap_service.go`

**Dependency:** `github.com/go-ldap/ldap/v3`

**Implementation steps:**
1. Env vars: `LDAP_URL` (ldap://host:389), `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`, `LDAP_USER_FILTER` (default: `(uid=%s)`)
2. `LDAPService.Authenticate(username, password string) (*LDAPUser, error)`:
   - Dial LDAP server
   - Bind with service account
   - Search for user with filter
   - Bind again with found DN + user password
   - Return user attributes (email, first_name, last_name, groups)
3. `POST /api/v1/auth/ldap/login` handler — call LDAPService, upsert user in DB, return JWT
4. Migration `009_add_ldap.sql`: `ALTER TABLE users ADD COLUMN ldap_dn TEXT;`
5. Admin UI at `/settings`: LDAP configuration form (URL, Base DN, Bind DN, filter, test connection button)

**Complexity:** M (3–4 days)

---

### P1-2: SSO (SAML 2.0)

**Files to create:**
- `services/auth/internal/handler/saml.go`
- `services/auth/internal/service/saml_service.go`

**Dependency:** `github.com/crewjam/saml`

**Implementation steps:**
1. `GET /api/v1/auth/saml/metadata` — serve SP metadata XML (entity ID, ACS URL, public cert)
2. `GET /api/v1/auth/saml/login` — generate AuthnRequest, redirect to IdP SSO URL
3. `POST /api/v1/auth/saml/acs` — Assertion Consumer Service:
   - Parse and validate SAMLResponse
   - Extract NameID + attributes (email, name, groups)
   - Upsert user, issue JWT, redirect to frontend
4. Store IdP metadata URL per organization in `organizations.settings JSONB`
5. Admin UI: SSO configuration page at `/settings` with IdP metadata URL input + test flow button

**Complexity:** L (5–7 days)

---

### P1-3: Discord Alert Provider

**File to create:** `services/notification/internal/provider/discord.go`

**Implementation steps:**
1. `DiscordProvider.Send(webhookURL, title, message string) error`:
   - POST to Discord webhook URL
   - Embed format: `{"embeds": [{"title": title, "description": message, "color": 16711680}]}`
2. Migration `services/notification/migrations/002_add_discord.sql`:
   ```sql
   ALTER TABLE notification_preferences ADD COLUMN discord_webhook TEXT;
   ```
3. Wire `DiscordProvider` into `NotificationHandler.dispatchExternal()`
4. Frontend: Discord webhook URL input in `/settings/notifications` page

**Complexity:** S (half day)

---

### P1-4: Generic Outbound Webhook Dispatcher

**Files to create:**
- `services/notification/internal/handler/webhooks.go`
- `services/notification/migrations/003_create_webhook_endpoints.sql`

**Implementation steps:**
1. Migration:
   ```sql
   CREATE TABLE webhook_endpoints (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID NOT NULL,
     url TEXT NOT NULL,
     secret VARCHAR(64) NOT NULL,
     events JSONB NOT NULL DEFAULT '["*"]',
     enabled BOOLEAN NOT NULL DEFAULT TRUE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE TABLE webhook_deliveries (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
     event_type VARCHAR(50) NOT NULL,
     payload JSONB NOT NULL,
     status_code INT,
     response_body TEXT,
     attempts INT NOT NULL DEFAULT 0,
     delivered_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
2. `GET/POST /api/v1/notifications/webhooks` — list and create endpoints
3. `DELETE /api/v1/notifications/webhooks/:id` — remove endpoint
4. Modify `Dispatch()` handler: after creating notification, fan-out to all enabled endpoints matching event type
5. Sign payload with HMAC-SHA256 using endpoint secret, set `X-XP-Signature` header
6. Retry logic: 3 attempts with backoff (5s, 30s, 5min), log each to webhook_deliveries
7. Frontend: webhook management section in `/settings/notifications`

**Complexity:** M (3 days)

---

### P1-5: OpenAPI Specification

**File to create:** `docs/api/openapi.yaml`

**Implementation steps:**
1. Create OpenAPI 3.1 spec documenting all 14 services' endpoints
2. Priority order: auth, gateway, dns, monitoring, billing (most-used first)
3. Add Swagger UI endpoint to gateway: `GET /docs` serves embedded swagger-ui HTML pointing to `/api/openapi.yaml`
4. Serve spec file: `GET /api/openapi.yaml` in gateway
5. Generate TypeScript types: `npx openapi-typescript docs/api/openapi.yaml -o apps/web/src/types/api.generated.ts`
6. Gradually migrate `apps/web/src/types/*.types.ts` to use generated types

**Complexity:** L (ongoing — 1–2 days initial, then incremental)

---

### P1-6: GeoIP Blocking

**Dependency:** `github.com/oschwald/maxminddb-golang`

**Files to modify/create:**
- `services/gateway/internal/middleware/geoip.go` (new)
- `services/security/internal/handler/firewall.go` (add country block endpoints)

**Implementation steps:**
1. Download MaxMind GeoLite2-Country.mmdb (free with registration, 7MB)
2. Add to Docker image: `COPY GeoLite2-Country.mmdb /data/`
3. Gateway middleware `geoip.go`:
   - Load MMDB on startup
   - On each request: lookup real IP (respect X-Forwarded-For) → get country code
   - Query Redis set `geoblock:{orgID}` for blocked countries
   - Return 403 with JSON error if match
4. `POST /api/v1/security/blocklist/countries` — add country code to org's blocklist
5. `DELETE /api/v1/security/blocklist/countries/:code` — remove
6. `GET /api/v1/security/blocklist/countries` — list blocked countries
7. Frontend: country multi-select with flag emojis in `/security/firewall` page

**Complexity:** M (2–3 days)

---

### P1-7: DNS Templates

**Files to create:**
- `services/dns/internal/handler/template.go`
- `services/dns/migrations/003_create_dns_templates.sql`

**Implementation steps:**
1. Migration:
   ```sql
   CREATE TABLE dns_templates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID,
     name VARCHAR(100) NOT NULL,
     description TEXT,
     records JSONB NOT NULL DEFAULT '[]',
     is_system BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
2. Seed system templates (is_system=true, organization_id=null):
   - "WordPress" — A, CNAME www, MX, TXT SPF
   - "Email (Full)" — MX x3, TXT SPF, TXT DKIM placeholder, TXT DMARC
   - "GitHub Pages" — A x4 (185.199.108-111.153), CNAME www
   - "Cloudflare Proxy" — A 192.0.2.1 (placeholder), CNAME www
3. `GET /api/v1/dns/templates` — list system + org templates
4. `POST /api/v1/dns/templates` — create custom template
5. `POST /api/v1/dns/zones/:id/apply-template/:templateID` — bulk insert records from template into zone
6. Frontend: template picker modal when creating a new DNS zone, dropdown on zone detail page

**Complexity:** S (2 days)

---

### P1-8: DNS Propagation Checker

**File to create:** `services/dns/internal/handler/propagation.go`

**Dependency:** `github.com/miekg/dns`

**Implementation steps:**
1. `GET /api/v1/dns/propagation?hostname={hostname}&type={A|MX|TXT|CNAME}`:
   - Query 8 public resolvers in parallel using goroutines
   - Resolvers: 8.8.8.8 (Google), 1.1.1.1 (Cloudflare), 9.9.9.9 (Quad9), 208.67.222.222 (OpenDNS), 84.200.69.80 (DNS.WATCH), 77.88.8.8 (Yandex), 64.6.64.6 (Verisign), 216.146.35.35 (Dyn)
   - Timeout each query at 5 seconds
   - Return: `{resolver: "8.8.8.8", name: "Google", result: ["1.2.3.4"], propagated: true, latency_ms: 42}`
2. Calculate consensus: `propagated_count / total_count * 100`
3. Frontend: propagation checker panel on `/dns` page — hostname input + record type selector + live resolver grid

**Complexity:** S (1–2 days)

---

### P1-9: i18n Framework

**Dependency:** `next-intl@3.x`

**Files to create:**
- `apps/web/i18n.ts`
- `apps/web/messages/en.json` (~2000 string keys)
- `apps/web/messages/dv.json` (Dhivehi — machine translated initially)
- `apps/web/src/middleware.ts` (update for locale routing)

**Implementation steps:**
1. `pnpm add next-intl` in `apps/web/`
2. Create `apps/web/i18n.ts` with supported locales: `['en', 'dv']`, default: `'en'`
3. Update `apps/web/next.config.ts` to include next-intl plugin
4. Wrap root layout `apps/web/src/app/layout.tsx` with `NextIntlClientProvider`
5. Extract all hardcoded English strings from all page and component files into `messages/en.json`
6. Replace hardcoded strings with `const t = useTranslations('namespace')` + `t('key')`
7. Add Dhivehi translations to `messages/dv.json` (start with machine translation, mark TODO for human review)
8. RTL support: add `dir={locale === 'dv' ? 'rtl' : 'ltr'}` attribute to `<html>` in `layout.tsx`
9. Language selector in `/settings/profile` — stores preference in user profile via API

**Complexity:** XL (2–3 weeks — string extraction is the long pole)

---

## P2 — Medium Priority

| # | Feature | Key Files | Dependencies | Complexity |
|---|---|---|---|---|
| P2-1 | CesiumJS 3D Threat Globe | `monitoring/geomap/page.tsx` (rewrite) | `cesium`, `resium` | L |
| P2-2 | Mapbox Infrastructure Map | new `monitoring/infrastructure/page.tsx` | `mapbox-gl`, `react-map-gl` | M |
| P2-3 | BGP/ASN Monitoring | new `monitoring/bgp/page.tsx` | RIPE Stat REST API (no backend needed) | S |
| P2-4 | Blue/Green Deployment Logic | `devops/handler/pipeline.go`, new `devops/handler/bluegreen.go` | none | M |
| P2-5 | PHP OPcache + php.ini Editor | `webserver/handler/php.go` + frontend monaco editor | none | M |
| P2-6 | Email DMARC + Mailing Lists + Vacation + Catch-all | new mail migrations 004–007 + handlers | none | M |
| P2-7 | DB Slow Query Detection | new `dbmanager/handler/analytics.go` | pg_stat_statements, performance_schema | M |
| P2-8 | PayPal Payment Integration | new `billing/handler/paypal.go` | `github.com/plutov/paypal/v4` | M |
| P2-9 | Crypto Payments | new `billing/handler/crypto.go` | NOWPayments API (REST) | M |
| P2-10 | Multi-Server Clustering UI | new `admin/clusters/page.tsx`, `gateway` aggregation | Leaflet.js (already in deps) | L |
| P2-11 | OpenTelemetry Instrumentation | all 14 service go.mod files + middleware | `go.opentelemetry.io/otel` | L |
| P2-12 | Compliance Dashboard | new `security/compliance/page.tsx` | none | M |
| P2-13 | Drag-and-Drop Dashboard Widgets | `dashboard/page.tsx` + store for layout | `react-grid-layout` | M |
| P2-14 | CrowdSec Integration | new `security/handler/crowdsec.go` | CrowdSec Local API (REST) | M |
| P2-15 | ModSecurity / WAF Rules UI | new security tab + `security/handler/waf.go` | ModSecurity C library via subprocess | L |
| P2-16 | File Manager Git Integration | new `filemanager/handler/git.go` | `go-git v5` | M |
| P2-17 | Container Snapshots + Registry | new `docker/handler/snapshot.go` | Docker SDK | M |
| P2-18 | GitHub/GitLab Webhook Triggers | new `devops/handler/webhook.go` | none | M |
| P2-19 | GUI Setup Wizard | new `apps/web/src/app/setup/` | none | L |
| P2-20 | TypeScript SDK + Go CLI | `cmd/xp-panel/main.go`, OpenAPI codegen | `cobra`, `openapi-typescript` | M |

### P2-1 Detail: CesiumJS 3D Globe
- Replace 2D canvas in `monitoring/geomap/page.tsx` with CesiumJS via `resium`
- `pnpm add cesium resium` in `apps/web/`
- Configure `next.config.ts` to copy Cesium static assets to `public/cesium/`
- Set `CESIUM_BASE_URL = '/cesium'` in runtime config
- Add `NEXT_PUBLIC_CESIUM_ION_TOKEN` env var (free token at cesium.com)
- Render attack arcs using `CesiumPolylineCollection` with great-circle paths
- Add 3D building layer, country border outlines, server location pins
- Retain existing live threat feed panel on the right side

### P2-3 Detail: BGP/ASN Monitoring
- Fetch from RIPE Stat API (no auth required, free):
  - `https://stat.ripe.net/data/bgp-state/data.json?resource={asn}`
  - `https://stat.ripe.net/data/prefix-overview/data.json?resource={prefix}`
  - `https://stat.ripe.net/data/asn-neighbours/data.json?resource={asn}`
- Show: prefix count, BGP peers, routing changes, origin AS, upstream providers
- Input: ASN number or IP prefix

### P2-4 Detail: Blue/Green Deployment
- Add `active_slot VARCHAR(5) DEFAULT 'blue'` to pipelines table via migration
- Add `deployments.slot` column (blue/green)
- `POST /api/v1/devops/deployments/:id/switch-slot` — toggle active_slot
- Frontend: blue/green toggle switch on pipeline detail page with traffic percentage slider
- Future: integrate with gateway to route % of traffic to each slot

### P2-12 Detail: Compliance Dashboard
- Pull data from existing tables: audit_logs, security_events, user_sessions, backups
- GDPR checks: encryption at rest, audit log retention, user deletion capability, consent tracking
- SOC2 checks: MFA enabled %, failed login rate, backup frequency, incident response time
- Display as checklist with pass/fail/partial status and remediation guidance

---

## P3 — Nice to Have

- **Submarine cable visualization** — Static GeoJSON overlay on CesiumJS globe showing undersea cable routes (data from submarinecablemap.com)
- **Google Drive backup destination** — `services/backup/internal/storage/gdrive.go` using Google Drive API
- **Nested resellers** — Add `parent_reseller_id UUID` to organizations, propagate quota checks up the chain
- **Full ARIA accessibility audit** — Run axe-core against all pages, fix ARIA labels, focus management, color contrast
- **Dhivehi human translation** — Machine translation is a start; needs native DV speaker for review of all ~2000 strings
- **SELinux/AppArmor UI** — Profile management and policy editor for per-container security policies
- **Edge computing nodes** — Register edge nodes (lightweight agents), geo-route traffic to nearest node
- **Service mesh integration** — Istio sidecar injection annotations in K8s Deployments, Kiali dashboard link
- **Rootkit detection** — `rkhunter` subprocess integration in security service with scheduled scans
- **WebDAV support** — WebDAV protocol endpoint in file manager service
- **SFTP browser** — Web-based SFTP client in file manager (SSH2 library)
- **File version history + trash** — Git-based or snapshot-based version history for files, 30-day trash recovery
- **MongoDB management UI** — Collections browser, index management, aggregation query builder
- **Redis management UI** — Keys browser, TTL editor, memory stats, pub/sub monitor
- **Vacation autoresponder** — Per-mailbox vacation message with start/end dates

---

## Recommended Implementation Order

```
Week 1–2   P0-1 WebAuthn  +  P0-2 OAuth2  +  P0-3 Stripe  +  P0-4 Auto-suspension
Week 3     P0-5 Usage metering  +  P0-6 Login history API + UI
Week 4     P1-3 Discord alerts  +  P1-4 Generic webhook dispatcher
Week 5     P1-6 GeoIP blocking  +  P1-7 DNS templates  +  P1-8 DNS propagation
Week 6–7   P1-1 LDAP integration
Week 8–9   P1-2 SSO (SAML 2.0)
Week 10–12 P1-9 i18n framework (string extraction is the long pole)
Week 13    P1-5 OpenAPI specification
Week 14    P2-1 CesiumJS 3D globe  +  P2-2 Mapbox infrastructure map
Week 15    P2-4 Blue/green deployment  +  P2-18 GitHub/GitLab webhooks
Week 16    P2-6 Email DMARC/lists  +  P2-7 Slow query detection
Week 17    P2-8 PayPal  +  P2-9 Crypto payments
Week 18    P2-13 Drag-and-drop dashboard  +  P2-19 GUI setup wizard
Week 19+   P2-10 Clustering, P2-11 OpenTelemetry, P2-12 Compliance, P2-14 CrowdSec
Ongoing    P3 items as bandwidth allows
```

---

## Dependency Map

```
P0-3 Stripe ──────────────→ P0-4 Auto-suspension (needs payment failure events)
P0-5 Usage Metering ───────→ Billing accuracy (needed before charging customers)
P1-1 LDAP ─────────────────→ P1-2 SSO (share auth provider abstraction layer)
P0-1 WebAuthn ─────────────→ P1-5 OpenAPI (need stable endpoint shape first)
P1-5 OpenAPI ──────────────→ P2-20 SDK + CLI generation
P1-9 i18n framework ───────→ P3 Dhivehi full translation
P2-1 CesiumJS globe ───────→ P3 Submarine cable overlay
P1-4 Webhook dispatcher ───→ P2-18 GitHub/GitLab webhooks (reuse delivery infra)
```

---

## Effort Estimate

| Priority | Count | Estimated Developer-Weeks |
|---|---|---|
| P0 — Critical | 6 items | 3–4 weeks |
| P1 — High | 9 items | 7–9 weeks |
| P2 — Medium | 20 items | 10–14 weeks |
| P3 — Nice to Have | 15 items | 6–10 weeks |
| **Total** | **50 items** | **~26–37 developer-weeks** |
