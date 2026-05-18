<div align="center">

<img src="https://raw.githubusercontent.com/xp-panel/xp-panel/main/apps/web/public/logo.svg" alt="XP-Panel Logo" width="120" height="120" />

# XP-Panel

**The next-generation open-source web hosting control panel.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-ready-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*Faster than DirectAdmin. More powerful than cPanel. More modern than Plesk.*

[Documentation](https://docs.xp-panel.io) · [Demo](https://demo.xp-panel.io) · [Report Bug](https://github.com/xp-panel/xp-panel/issues) · [Request Feature](https://github.com/xp-panel/xp-panel/issues)

</div>

---

## What is XP-Panel?

XP-Panel is a modern, enterprise-grade, open-source web hosting control panel built to compete with and surpass cPanel, DirectAdmin, Plesk, CyberPanel, CloudPanel, ISPConfig, RunCloud, and Laravel Forge.

It combines the usability of cPanel, the lightweight performance of DirectAdmin, the cloud-native architecture of Kubernetes, modern DevOps tooling, and AI-assisted server automation — all in a single, beautiful, production-ready platform.

Built with **Go** (backend microservices) and **Next.js 15** (frontend), XP-Panel is designed to be extremely fast, secure, and extensible.

---

## Screenshots

> Coming soon — screenshots and demo GIFs will be added after Phase 1 completion.

---

## Key Features

### Hosting Management
- **Domain & DNS Management** — Full DNS zone editor, GeoDNS, DNSSEC, DNS templates, propagation checker
- **Web Server Control** — NGINX, Apache, LiteSpeed, OpenLiteSpeed, Caddy — with HTTP/3, Brotli, caching, and rate limiting
- **PHP Management** — MultiPHP, PHP-FPM, custom php.ini per domain, OPcache, Composer integration
- **Database Manager** — MySQL, MariaDB, PostgreSQL, MongoDB, Redis — with query analytics and slow query detection
- **Email System** — Postfix/Exim/Dovecot, DKIM/SPF/DMARC, anti-spam, webmail, email routing

### Security
- **WAF & Firewall** — Coraza WAF, CSF/nftables firewall, CrowdSec, Fail2Ban integration
- **AI Threat Detection** — Machine learning anomaly detection, GeoIP blocking, brute-force protection
- **Malware Scanner** — ClamAV integration, rootkit detection, automatic vulnerability scanning
- **Zero Trust Architecture** — mTLS between services, HashiCorp Vault secrets, RBAC + ABAC

### Cloud & DevOps
- **Container Management** — Docker UI, Docker Compose deployment, Kubernetes integration
- **CI/CD Pipelines** — Git deployments, GitHub/GitLab integration, blue/green deployments, rollback
- **Infrastructure as Code** — Terraform integration, Ansible playbooks, GitOps-ready
- **Multi-Server Clustering** — HA failover, distributed storage, load balancing

### AI-Powered Administration
- **AI Hosting Assistant** — Natural language server commands ("Optimize this server", "Fix email delivery")
- **AI Log Analysis** — Automatic root cause detection and fix suggestions
- **AI Anomaly Detection** — Predictive maintenance, auto-scaling suggestions, billing anomaly detection
- **Voice Control** — Speak commands to manage your server (experimental)
- **Self-Healing Servers** — Autonomous remediation for common failures

### GeoMap & Infrastructure Intelligence
- **3D Infrastructure Globe** — CesiumJS-powered real-time attack visualization
- **Threat Origin Mapping** — Live DDoS and brute-force source heatmaps
- **GeoDNS Analytics** — Routing analytics, CDN visualization, latency heatmaps
- **BGP/ASN Monitoring** — Network route optimization, peering analytics

### Billing & Multi-Tenancy
- **Integrated Billing** — Stripe, PayPal, crypto payments, usage-based billing
- **Reseller System** — White-label branding, nested resellers, custom packages, usage reports
- **SaaS Multi-Tenancy** — Isolated organizations, custom domains per tenant

---

## Comparison

| Feature | XP-Panel | cPanel | DirectAdmin | Plesk | CyberPanel |
|---|:---:|:---:|:---:|:---:|:---:|
| Open Source | ✅ AGPL | ❌ | ❌ | ❌ | ✅ |
| AI Assistant | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cloud Native / K8s | ✅ | ❌ | ❌ | Limited | ❌ |
| Voice Control | ✅ | ❌ | ❌ | ❌ | ❌ |
| Real-time Metrics | ✅ WebSocket | Limited | Limited | Limited | Limited |
| GeoMap Visualization | ✅ 3D Globe | ❌ | ❌ | ❌ | ❌ |
| DevOps Pipelines | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| WASM Plugin System | ✅ | ❌ | ❌ | ❌ | ❌ |
| Self-Healing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modern UI | ✅ | Dated | Basic | OK | OK |
| Multi-Web Servers | ✅ 5 options | Limited | Limited | ✅ | LiteSpeed |
| Free Forever | ✅ Core | ❌ | ❌ | ❌ | ✅ Core |

---

## Architecture Overview

XP-Panel uses a **modular microservice architecture** with 14 independent services:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet / Users                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────▼────────────────────────────────────┐
│              Next.js 15 Frontend  (Port 3000)                   │
│   App Shell · Dashboard · DNS Editor · File Manager · AI Chat   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / GraphQL / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│              API Gateway  (Port 8080)                           │
│   JWT Auth · Rate Limiting · WAF · Tenant Isolation · Proxy     │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┘
   │      │      │      │      │      │      │      │      │
  Auth   DNS   Mail  Web   Files  DB  Backup Monitor Billing ...
 :8081 :8082 :8083 :8084 :8085 :8086 :8087  :8088  :8089
                             │
┌────────────────────────────▼────────────────────────────────────┐
│         Infrastructure Layer                                    │
│   PostgreSQL · Redis · ClickHouse · Vault · MinIO · PowerDNS   │
└─────────────────────────────────────────────────────────────────┘
```

### Services

| Service | Port | Responsibility |
|---|---|---|
| **gateway** | 8080 | API gateway, JWT validation, rate limiting, reverse proxy |
| **auth** | 8081 | Authentication, JWT, OAuth2, MFA, WebAuthn/Passkeys |
| **dns** | 8082 | DNS zone management, PowerDNS integration |
| **mail** | 8083 | Email provisioning, DKIM, Postfix/Dovecot management |
| **webserver** | 8084 | NGINX/Apache/LiteSpeed vhost management, PHP-FPM |
| **filemanager** | 8085 | File operations, chunked uploads, Monaco editor backend |
| **dbmanager** | 8086 | MySQL/PostgreSQL/MongoDB management |
| **backup** | 8087 | Incremental backups, S3/B2/local storage, encryption |
| **monitoring** | 8088 | Metrics collection, ClickHouse ingestion, alerting |
| **billing** | 8089 | Stripe subscriptions, invoices, usage metering |
| **ai** | 8090 | AI assistant, log analysis, voice command parsing |
| **security** | 8091 | WAF, firewall, malware scanner, anomaly detection |
| **marketplace** | 8092 | App registry, one-click installers, WASM plugins |
| **devops** | 8093 | CI/CD pipelines, Git deployments, Docker management |
| **notification** | 8094 | Email/Slack/Telegram/Discord/webhook alerts |

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.x | React framework (App Router, SSR) |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first CSS |
| ShadCN UI | latest | Accessible component system |
| Framer Motion | 11.x | Animations |
| Zustand | 5.x | Client state |
| TanStack Query | 5.x | Server state + data fetching |
| Recharts | 2.x | Charts and graphs |
| Monaco Editor | latest | In-browser code editor |
| CesiumJS | 1.x | 3D globe visualization |
| Leaflet.js | 1.9.x | 2D infrastructure maps |

### Backend (Go)
| Technology | Version | Purpose |
|---|---|---|
| Go | 1.23.x | Backend language |
| Fiber v3 | 3.x | HTTP framework (fastest Go framework) |
| sqlc | 1.27.x | Type-safe SQL codegen |
| goose | 3.x | Database migrations |
| gqlgen | 0.17.x | GraphQL server |
| asynq | 0.24.x | Redis job queues |
| lego | 4.x | Let's Encrypt ACME |
| go-git | 5.x | Git operations |
| wazero | 1.x | WASM plugin runtime |

### Infrastructure
| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | 16.x | Primary database |
| Redis | 7.x | Cache, queues, pub/sub |
| ClickHouse | 24.x | Time-series metrics |
| HashiCorp Vault | 1.16.x | Secrets management |
| MinIO | latest | S3-compatible storage |
| PowerDNS | 4.9.x | DNS server |
| Docker | 26.x | Container runtime |
| Kubernetes | 1.30.x | Container orchestration |

---

## User Roles

| Role | Description |
|---|---|
| **Super Admin** | Full platform access — manage everything |
| **Admin** | Server-level management — manage all users on assigned servers |
| **Reseller** | Manage their own users within resource quotas, white-label branding |
| **User** | Manage their own domains, email, databases, files, backups |
| **Developer** | All User access + DevOps pipelines, Docker, CI/CD |
| **Read-only Auditor** | View-only access to all resources for compliance |

---

## Quick Start

### Prerequisites
- Docker 26+ and Docker Compose v2
- 2 GB RAM minimum (4 GB recommended)
- 20 GB disk space

### Option 1: One-line Installer
```bash
curl -fsSL https://install.xp-panel.io | bash
```

### Option 2: Docker Compose (Recommended for Development)
```bash
# 1. Clone the repository
git clone https://github.com/xp-panel/xp-panel.git
cd xp-panel

# 2. Install dependencies
make install

# 3. Start the full development environment
make dev

# 4. Open your browser
# Panel:    http://localhost:3000
# API:      http://localhost:8080/api/v1
# API Docs: http://localhost:8080/docs
# MinIO:    http://localhost:9001
# Vault:    http://localhost:8200
# Mailhog:  http://localhost:8025
```

### Option 3: Kubernetes (Production)
```bash
# Using Helm
helm repo add xp-panel https://charts.xp-panel.io
helm install xp-panel xp-panel/xp-panel \
  --namespace xp-panel --create-namespace \
  --set global.domain=panel.yourdomain.com \
  --set postgresql.enabled=true \
  --set redis.enabled=true
```

### Option 4: Bare Metal
```bash
# Using Ansible
ansible-playbook -i inventory/hosts.yml playbooks/setup-server.yml
```

---

## Project Structure

```
xp-panel/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   └── docs/                   # Documentation site
├── services/                   # 14 Go microservices
│   ├── gateway/                # API Gateway
│   ├── auth/                   # Authentication
│   ├── dns/                    # DNS Management
│   ├── mail/                   # Email System
│   ├── webserver/              # Web Server Manager
│   ├── filemanager/            # File Manager
│   ├── dbmanager/              # Database Manager
│   ├── backup/                 # Backup System
│   ├── monitoring/             # Monitoring & Alerting
│   ├── billing/                # Billing & Subscriptions
│   ├── ai/                     # AI Assistant
│   ├── security/               # Security Service
│   ├── marketplace/            # App Marketplace
│   ├── devops/                 # CI/CD & DevOps
│   └── notification/           # Notifications
├── packages/                   # Shared packages
├── infrastructure/             # Docker, K8s, Terraform, Ansible
├── scripts/                    # Installer scripts
└── docs/                       # Architecture & API docs
```

---

## Development Roadmap

### Phase 1 — Foundation *(In Progress)*
- [x] Master architecture plan
- [ ] Project scaffolding and monorepo setup
- [ ] Auth service (JWT, OAuth2, MFA, WebAuthn)
- [ ] API Gateway with JWT middleware and rate limiting
- [ ] Next.js frontend shell (sidebar, topbar, command palette)
- [ ] Dashboard with real-time WebSocket metrics
- [ ] Complete database schema (41 migrations)
- [ ] Docker Compose dev environment

### Phase 2 — Core Hosting Features
- [ ] Domain management
- [ ] DNS zone editor (PowerDNS integration)
- [ ] Email system (Postfix/Dovecot, DKIM)
- [ ] File manager with Monaco editor
- [ ] PHP-FPM management
- [ ] SSL/TLS automation (Let's Encrypt)

### Phase 3 — Advanced Services
- [ ] Backup system (incremental, encrypted, S3/B2)
- [ ] Real-time monitoring (ClickHouse + WebSocket)
- [ ] Security center (WAF, firewall, malware scanner)
- [ ] Database manager (MySQL, PostgreSQL, MongoDB)

### Phase 4 — Enterprise Layer
- [ ] Docker/container management
- [ ] CI/CD pipeline engine
- [ ] Billing system (Stripe integration)
- [ ] AI assistant (Claude/OpenAI + local model)
- [ ] App marketplace with WASM plugins
- [ ] Reseller system

### Phase 5 — Innovation Layer
- [ ] GeoMap 3D globe (CesiumJS threat visualization)
- [ ] Voice control (Web Speech API + Whisper)
- [ ] Self-healing infrastructure
- [ ] Edge AI inference (local GGUF model)
- [ ] BGP/ASN route monitoring

---

## Contributing

We welcome contributions! XP-Panel is built by the community, for the community.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Check [open issues](https://github.com/xp-panel/xp-panel/issues) for tasks
3. Fork the repo and create a feature branch
4. Submit a pull request

### Development Setup
```bash
# Install Go 1.23+, Node.js 22+, pnpm 9+, Docker

# Install all dependencies
make install

# Start only infrastructure (DB, Redis, etc.)
docker-compose up -d postgres redis clickhouse vault minio

# Run database migrations
make migrate

# Start a specific service in hot-reload mode
cd services/auth && air

# Start the frontend in dev mode
cd apps/web && pnpm dev
```

---

## Security

We take security seriously. If you discover a security vulnerability:

- **Do NOT** open a public GitHub issue
- Email: security@xp-panel.io
- See [SECURITY.md](SECURITY.md) for our responsible disclosure policy

### Security Features
- Argon2id password hashing
- RS256 JWT signing (asymmetric keys)
- AES-256-GCM backup encryption
- HashiCorp Vault for all secrets
- mTLS between microservices
- Coraza WAF (Go-native ModSecurity)
- Zero Trust network architecture
- SOC2/GDPR compliance tooling

---

## API

XP-Panel provides both REST and GraphQL APIs.

### REST API
```
Base URL: https://your-panel.com/api/v1
Auth:     Bearer JWT token

# Example: List domains
curl -H "Authorization: Bearer $TOKEN" \
  https://your-panel.com/api/v1/domains
```

### GraphQL
```
Endpoint: https://your-panel.com/graphql
Playground: https://your-panel.com/graphql (dev mode only)
```

Full API documentation: [docs.xp-panel.io/api](https://docs.xp-panel.io/api)

OpenAPI 3.1 spec: [`docs/api/openapi.yaml`](docs/api/openapi.yaml)

---

## License

XP-Panel is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- ✅ Free to use, modify, and distribute
- ✅ Commercial use allowed
- ✅ Private modifications allowed
- ⚠️ If you run a modified version as a network service, you must release the source code
- ⚠️ All forks must also be AGPL-3.0

See [LICENSE](LICENSE) for the full license text.

For commercial licensing (closed-source modifications), contact: license@xp-panel.io

---

## Acknowledgments

XP-Panel is inspired by and built to improve upon the following great projects:
- [cPanel](https://cpanel.net/) — The hosting industry standard
- [DirectAdmin](https://www.directadmin.com/) — Lightweight and fast
- [Plesk](https://www.plesk.com/) — Feature-rich and extensible
- [CyberPanel](https://cyberpanel.net/) — Open-source LiteSpeed panel
- [ISPConfig](https://www.ispconfig.org/) — Classic open-source panel
- [Webmin](https://webmin.com/) — The original web admin tool

And built with amazing open-source technologies from the Go, Next.js, and cloud-native ecosystems.

---

<div align="center">

**Built with ❤️ by the XP-Panel community**

[Website](https://xp-panel.io) · [Documentation](https://docs.xp-panel.io) · [Discord](https://discord.gg/xp-panel) · [Twitter](https://twitter.com/xp_panel)

⭐ Star us on GitHub — it helps the project grow!

</div>
