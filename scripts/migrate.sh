#!/usr/bin/env bash
# Run goose migrations for all XP-Panel services
set -euo pipefail

DIRECTION="${1:-up}"
DATABASE_URL="${DATABASE_URL:-postgres://xppanel:devpassword@localhost:5432/xppanel?sslmode=disable}"

SERVICES=(
  "auth"
  "dns"
  "mail"
  "webserver"
  "filemanager"
  "dbmanager"
  "backup"
  "monitoring"
  "billing"
  "security"
  "marketplace"
  "devops"
  "notification"
)

if ! command -v goose &>/dev/null; then
  echo "❌ goose not found. Run: go install github.com/pressly/goose/v3/cmd/goose@latest"
  exit 1
fi

echo "▶ Running migrations ($DIRECTION) on: $DATABASE_URL"
echo ""

for svc in "${SERVICES[@]}"; do
  MIGRATION_DIR="services/$svc/migrations"
  if [ -d "$MIGRATION_DIR" ] && [ -n "$(ls -A "$MIGRATION_DIR"/*.sql 2>/dev/null)" ]; then
    echo "  ↳ $svc"
    goose -dir "$MIGRATION_DIR" postgres "$DATABASE_URL" "$DIRECTION" 2>&1 | sed 's/^/    /'
  fi
done

echo ""
echo "✅ Migrations complete ($DIRECTION)"
