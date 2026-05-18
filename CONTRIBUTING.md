# Contributing to XP-Panel

Thank you for your interest in contributing to XP-Panel! This document explains how to get involved.

## Code of Conduct

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/xp-panel/xp-panel/issues) first
2. Use the **Bug Report** template
3. Include: OS, Docker version, XP-Panel version, reproduction steps, expected vs actual behavior

### Suggesting Features

1. Search [existing issues](https://github.com/xp-panel/xp-panel/issues) first
2. Use the **Feature Request** template
3. Describe the use case, not just the solution

### Submitting Code

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feat/your-feature-name`
3. **Make your changes** following the guidelines below
4. **Test** your changes: `make test`
5. **Lint** your code: `make lint`
6. **Commit** with a clear message (see Commit Convention below)
7. **Push** and open a **Pull Request**

## Development Setup

### Prerequisites

- Go 1.23+
- Node.js 22+
- pnpm 9+
- Docker 26+ and Docker Compose v2

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/xp-panel.git
cd xp-panel

# Install all dependencies
make install

# Start infrastructure (DB, Redis, etc.)
docker-compose up -d postgres redis clickhouse vault minio

# Run migrations
make migrate

# Start everything
make dev
```

### Working on a Single Service

```bash
# Start only the auth service in hot-reload mode
cd services/auth
air

# Run tests for a single service
cd services/auth
go test ./... -v
```

### Working on the Frontend

```bash
cd apps/web
pnpm dev           # Start with hot reload
pnpm type-check    # TypeScript check
pnpm lint          # ESLint check
pnpm test          # Vitest unit tests
```

## Code Guidelines

### Go (Backend Services)

- Follow the [Go style guide](https://google.github.io/styleguide/go/)
- Run `golangci-lint run ./...` before committing
- Write table-driven tests for all new functions
- Never use `panic()` in library code — return errors
- Use `sqlc` for all database queries (no raw string SQL)
- Keep handlers thin — business logic belongs in the service layer

### TypeScript / React (Frontend)

- Use TypeScript strictly — no `any` types
- Use ShadCN UI components where possible
- Use TanStack Query for all server state
- Use Zustand for client-only state
- Write components as named exports, not default exports
- Prefer `const` arrow functions for React components

### Database

- Every schema change requires a `goose` migration file
- Never modify existing migration files — always add a new one
- Add appropriate indexes for every foreign key and frequently queried column
- Add `CHECK` constraints for enum-style columns

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Scopes**: `auth`, `dns`, `mail`, `webserver`, `filemanager`, `dbmanager`, `backup`, `monitoring`, `billing`, `ai`, `security`, `marketplace`, `devops`, `notification`, `gateway`, `web`, `infra`

**Examples**:
```
feat(auth): add WebAuthn passkey registration
fix(dns): handle CNAME record validation edge case
docs(api): add OpenAPI spec for billing endpoints
perf(monitoring): batch ClickHouse inserts to reduce latency
```

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update documentation if you change APIs or behavior
- Reference the related issue: `Closes #123`
- Screenshots or GIFs for UI changes

## Questions?

- Open a [GitHub Discussion](https://github.com/xp-panel/xp-panel/discussions)
- Join our [Discord](https://discord.gg/xp-panel)

Thank you for making XP-Panel better! 🚀
