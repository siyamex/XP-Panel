#!/usr/bin/env bash
# XP-Panel One-Line Installer
# Usage: curl -fsSL https://install.xp-panel.io | bash
set -euo pipefail

PANEL_VERSION="${XP_VERSION:-latest}"
INSTALL_DIR="${XP_DIR:-/opt/xp-panel}"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

banner() {
  echo -e "${BLUE}"
  echo "  ██╗  ██╗██████╗       ██████╗  █████╗ ███╗   ██╗███████╗██╗"
  echo "  ╚██╗██╔╝██╔══██╗      ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║"
  echo "   ╚███╔╝ ██████╔╝█████╗██████╔╝███████║██╔██╗ ██║█████╗  ██║"
  echo "   ██╔██╗ ██╔═══╝ ╚════╝██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║"
  echo "  ██╔╝ ██╗██║           ██║     ██║  ██║██║ ╚████║███████╗███████╗"
  echo "  ╚═╝  ╚═╝╚═╝           ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝"
  echo -e "${NC}"
  echo -e "  ${GREEN}Enterprise Web Hosting Control Panel${NC}"
  echo ""
}

check_requirements() {
  echo "▶ Checking requirements..."
  local ok=true

  # OS check
  if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}❌ XP-Panel requires Linux. Detected: $OSTYPE${NC}"
    exit 1
  fi

  # Docker
  if ! command -v docker &>/dev/null; then
    echo -e "${YELLOW}⚠  Docker not found. Installing...${NC}"
    install_docker
  fi

  # Docker Compose v2
  if ! docker compose version &>/dev/null; then
    echo -e "${RED}❌ Docker Compose v2 is required. Run: apt install docker-compose-plugin${NC}"
    exit 1
  fi

  # RAM check (2GB minimum)
  local ram_mb
  ram_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ "$ram_mb" -lt 1900 ]; then
    echo -e "${RED}❌ Minimum 2GB RAM required. Found: ${ram_mb}MB${NC}"
    exit 1
  fi

  # Disk check (20GB minimum)
  local disk_gb
  disk_gb=$(df -BG / | awk 'NR==2 {print int($4)}')
  if [ "$disk_gb" -lt 20 ]; then
    echo -e "${YELLOW}⚠  Warning: Less than 20GB free disk space (${disk_gb}GB)${NC}"
  fi

  echo -e "${GREEN}✅ Requirements satisfied${NC}"
}

install_docker() {
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

generate_secrets() {
  echo "▶ Generating secrets..."
  cat > "$INSTALL_DIR/.env" <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 16)
CLICKHOUSE_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
PDNS_API_KEY=$(openssl rand -hex 16)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
VAULT_TOKEN=
VERSION=$PANEL_VERSION
ENV=production
EOF
  echo -e "${GREEN}✅ Secrets generated${NC}"
}

run_panel() {
  echo "▶ Pulling Docker images..."
  docker compose -f "$COMPOSE_FILE" pull

  echo "▶ Starting XP-Panel..."
  docker compose -f "$COMPOSE_FILE" up -d

  echo ""
  echo -e "${GREEN}  ╔══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}  ║   XP-Panel is running! 🎉            ║${NC}"
  echo -e "${GREEN}  ╠══════════════════════════════════════╣${NC}"
  echo -e "${GREEN}  ║  Panel:  http://$(hostname -I | awk '{print $1}'):3000     ║${NC}"
  echo -e "${GREEN}  ║  API:    http://$(hostname -I | awk '{print $1}'):8080     ║${NC}"
  echo -e "${GREEN}  ╚══════════════════════════════════════╝${NC}"
  echo ""
}

main() {
  banner
  check_requirements
  mkdir -p "$INSTALL_DIR"

  echo "▶ Downloading XP-Panel $PANEL_VERSION..."
  curl -fsSL "https://github.com/xp-panel/xp-panel/releases/download/$PANEL_VERSION/docker-compose.yml" \
    -o "$COMPOSE_FILE"

  generate_secrets
  run_panel
}

main "$@"
