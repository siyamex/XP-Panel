.DEFAULT_GOAL := help
SHELL         := /bin/bash
VERSION       ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
REGISTRY      ?= ghcr.io/xp-panel/xp-panel

.PHONY: help dev build test lint migrate migrate-down clean install logs db-shell \
        build-frontend build-services docker-build docker-push proto sqlc

# ─── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  XP-Panel — Development Commands"
	@echo "  ══════════════════════════════════════"
	@echo ""
	@echo "  make dev           Start full development environment"
	@echo "  make build         Build all services and frontend"
	@echo "  make test          Run all tests (Go + JS)"
	@echo "  make lint          Run all linters"
	@echo "  make migrate       Run all database migrations (up)"
	@echo "  make migrate-down  Roll back last migration"
	@echo "  make seed          Load demo seed data"
	@echo "  make install       Install all dependencies"
	@echo "  make clean         Stop containers and remove volumes"
	@echo "  make db-shell      Open PostgreSQL shell"
	@echo "  make logs          Tail all service logs"
	@echo "  make proto         Regenerate gRPC protobuf files"
	@echo "  make sqlc          Regenerate sqlc type-safe queries"
	@echo "  make docker-build  Build all Docker images"
	@echo "  make docker-push   Push Docker images to registry"
	@echo ""

# ─── Development ───────────────────────────────────────────────────────────────
dev: ## Start full dev environment
	@echo "▶ Starting infrastructure..."
	docker compose up -d postgres redis clickhouse vault minio powerdns mailhog
	@echo "▶ Waiting for PostgreSQL..."
	@until docker compose exec -T postgres pg_isready -U xppanel >/dev/null 2>&1; do sleep 1; done
	@echo "▶ Running migrations..."
	@$(MAKE) migrate
	@echo "▶ Starting all services..."
	docker compose up -d
	@echo ""
	@echo "  ✅ XP-Panel is running!"
	@echo "  ─────────────────────────────────────"
	@echo "  Panel:    http://localhost:3000"
	@echo "  API:      http://localhost:8080/api/v1"
	@echo "  API Docs: http://localhost:8080/docs"
	@echo "  MinIO:    http://localhost:9001"
	@echo "  Vault:    http://localhost:8200"
	@echo "  Mailhog:  http://localhost:8025"
	@echo ""

dev-infra: ## Start infrastructure only (DB, Redis, etc.)
	docker compose up -d postgres redis clickhouse vault minio powerdns mailhog

dev-services: ## Start backend services only (no frontend)
	docker compose up -d gateway auth dns mail webserver filemanager dbmanager \
	                     backup monitoring billing ai security marketplace devops notification

# ─── Install ───────────────────────────────────────────────────────────────────
install: ## Install all dependencies
	@echo "▶ Installing Node.js dependencies..."
	pnpm install
	@echo "▶ Syncing Go workspace..."
	go work sync
	@echo "▶ Installing Go tools..."
	go install github.com/air-verse/air@latest
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/pressly/goose/v3/cmd/goose@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "✅ All dependencies installed"

# ─── Build ─────────────────────────────────────────────────────────────────────
build: build-frontend build-services ## Build everything

build-frontend: ## Build Next.js frontend
	pnpm --filter web run build

build-services: ## Build all Go services
	@for svc in gateway auth dns mail webserver filemanager dbmanager backup monitoring billing ai security marketplace devops notification; do \
		echo "▶ Building $$svc..."; \
		cd services/$$svc && go build -ldflags="-s -w -X main.version=$(VERSION)" -o bin/$$svc ./cmd/$$svc && cd ../..; \
	done

# ─── Test ──────────────────────────────────────────────────────────────────────
test: test-services test-frontend ## Run all tests

test-services: ## Run Go service tests
	go test ./services/... -race -count=1 -timeout=120s

test-frontend: ## Run frontend tests
	pnpm --filter web run test

test-coverage: ## Run Go tests with coverage report
	go test ./services/... -race -coverprofile=coverage.out -covermode=atomic
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# ─── Lint ──────────────────────────────────────────────────────────────────────
lint: lint-services lint-frontend ## Run all linters

lint-services: ## Lint Go services
	golangci-lint run ./services/...

lint-frontend: ## Lint frontend
	pnpm --filter web run lint
	pnpm --filter web run type-check

# ─── Migrations ────────────────────────────────────────────────────────────────
migrate: ## Run all migrations (up)
	@bash scripts/migrate.sh up

migrate-down: ## Roll back last migration per service
	@bash scripts/migrate.sh down

migrate-status: ## Show migration status
	@bash scripts/migrate.sh status

migrate-create: ## Create new migration: make migrate-create SVC=auth NAME=add_passkeys
	@goose -dir services/$(SVC)/migrations create $(NAME) sql

# ─── Code Generation ───────────────────────────────────────────────────────────
sqlc: ## Regenerate sqlc type-safe query code
	@for svc in auth dns mail webserver filemanager dbmanager backup monitoring billing security marketplace devops notification; do \
		if [ -f services/$$svc/sqlc.yaml ]; then \
			echo "▶ sqlc generate: $$svc"; \
			cd services/$$svc && sqlc generate && cd ../..; \
		fi; \
	done

proto: ## Regenerate gRPC protobuf files
	@for svc in gateway auth; do \
		if [ -d services/$$svc/proto ]; then \
			echo "▶ protoc: $$svc"; \
			protoc --go_out=. --go-grpc_out=. services/$$svc/proto/*.proto; \
		fi; \
	done

# ─── Docker ────────────────────────────────────────────────────────────────────
docker-build: ## Build all Docker images
	@for svc in gateway auth dns mail webserver filemanager dbmanager backup monitoring billing ai security marketplace devops notification; do \
		echo "▶ Building image: xp-panel/$$svc:$(VERSION)"; \
		docker build -t $(REGISTRY)/$$svc:$(VERSION) -t $(REGISTRY)/$$svc:latest services/$$svc; \
	done
	docker build -t $(REGISTRY)/web:$(VERSION) -t $(REGISTRY)/web:latest apps/web

docker-push: ## Push Docker images to registry
	@for svc in gateway auth dns mail webserver filemanager dbmanager backup monitoring billing ai security marketplace devops notification web; do \
		docker push $(REGISTRY)/$$svc:$(VERSION); \
		docker push $(REGISTRY)/$$svc:latest; \
	done

# ─── Utilities ─────────────────────────────────────────────────────────────────
clean: ## Stop all containers and remove volumes
	docker compose down -v --remove-orphans
	@echo "✅ All containers and volumes removed"

logs: ## Tail all service logs
	docker compose logs -f --tail=50

logs-svc: ## Tail a single service: make logs-svc SVC=auth
	docker compose logs -f --tail=100 $(SVC)

seed: ## Load demo seed data into the database
	@echo "Loading seed data..."
	docker compose exec -T postgres psql -U xppanel xppanel < scripts/seed.sql
	@echo "✅ Seed data loaded"

seed-password: ## Set demo user passwords (run after seed)
	@bash scripts/create-admin.sh

db-shell: ## Open PostgreSQL shell
	docker compose exec postgres psql -U xppanel xppanel

redis-shell: ## Open Redis CLI
	docker compose exec redis redis-cli

vault-token: ## Print Vault root token
	@echo "Vault token: dev-root-token"
	@echo "Vault UI: http://localhost:8200"

ps: ## Show running containers
	docker compose ps
