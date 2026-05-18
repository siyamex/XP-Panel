# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| main (latest) | ✅ Active |
| Previous releases | Security patches only |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report

Send an email to **security@xp-panel.io** with:

1. **Description** — What is the vulnerability and what can an attacker do?
2. **Steps to reproduce** — Detailed reproduction steps
3. **Impact** — Who is affected and in what scenarios?
4. **Proof of concept** — Code or screenshots (if safe to share)
5. **Suggested fix** — If you have one

### What to Expect

- **Acknowledgment** within 48 hours
- **Status update** within 7 days
- **Patch release** within 30 days for critical issues
- **Credit** in the release notes (if desired)

### Scope

**In scope:**
- Authentication bypass
- Remote code execution
- SQL injection
- Privilege escalation
- Sensitive data exposure
- Server-side request forgery (SSRF)
- Path traversal in file manager
- Cross-site scripting (XSS) with significant impact

**Out of scope:**
- Denial of service attacks
- Social engineering
- Physical attacks
- Issues requiring physical access to the server

## Security Architecture

XP-Panel is built with security as a first principle:

- **Passwords**: Argon2id (m=65536, t=3, p=4)
- **JWT tokens**: RS256 asymmetric signing, 15-minute expiry
- **Secrets**: HashiCorp Vault (never in environment variables in production)
- **Database credentials**: Vault dynamic secrets (rotated hourly)
- **Backup encryption**: AES-256-GCM
- **Inter-service**: mTLS mutual authentication
- **WAF**: Coraza (Go-native ModSecurity)
- **Rate limiting**: Redis sliding window per IP and per user
- **Audit logging**: All mutating API calls logged with full context

## Responsible Disclosure

We follow a coordinated vulnerability disclosure process. We ask that you:

1. Give us reasonable time to fix the issue before public disclosure
2. Make a good-faith effort to avoid data destruction or service disruption
3. Only test against your own instances, not production systems

We will not pursue legal action against researchers who follow these guidelines.
