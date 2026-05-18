# Changelog

All notable changes to XP-Panel will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial project architecture and master plan
- Complete database schema (41 migrations across all services)
- Monorepo structure with 14 Go microservices and Next.js 15 frontend
- RBAC permission model (6 roles: super_admin, admin, reseller, user, developer, auditor)
- Docker Compose development environment
- GitHub Actions CI/CD pipeline definitions
- Kubernetes Helm chart structure
- Terraform infrastructure modules
- Ansible server provisioning playbooks
- OpenAPI 3.1 specification structure
- Contributing guidelines, security policy, and code of conduct

### Services Planned
- `gateway` — API Gateway with JWT, rate limiting, WAF
- `auth` — Authentication with JWT, OAuth2, MFA, WebAuthn
- `dns` — DNS zone management with PowerDNS integration
- `mail` — Email system with Postfix/Dovecot/DKIM
- `webserver` — NGINX/Apache/LiteSpeed/Caddy management
- `filemanager` — File operations with Monaco editor
- `dbmanager` — MySQL/PostgreSQL/MongoDB management
- `backup` — Encrypted incremental backups (S3/B2/local)
- `monitoring` — Real-time metrics with ClickHouse
- `billing` — Stripe subscriptions and invoicing
- `ai` — AI assistant with Claude/OpenAI integration
- `security` — WAF, firewall, malware scanner
- `marketplace` — App marketplace with WASM plugins
- `devops` — CI/CD pipelines and Git deployments
- `notification` — Multi-channel alerts (Email/Slack/Telegram/Discord)

---

## [0.1.0] - Upcoming

Initial public release — Phase 1 Foundation:
- Working authentication system
- Dashboard shell with real-time metrics
- Basic domain management
- Full development environment
