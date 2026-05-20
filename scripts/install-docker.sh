#!/usr/bin/env bash
# install-docker.sh — Install XP-Panel via Docker Compose
# Usage: bash scripts/install-docker.sh

set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

# ─── Detect OS ────────────────────────────────────────────────────────────────
detect_os() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    source /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_FAMILY="${ID_LIKE:-$ID}"
  else
    error "Cannot detect OS — /etc/os-release not found."
  fi

  case "${OS_ID}" in
    ubuntu|debian)  PKG_MGR="apt-get" ;;
    centos|rhel|fedora|rocky|almalinux) PKG_MGR="dnf" ;;
    *) warn "Unrecognised OS '${OS_ID}'. Proceeding anyway (may fail)." ; PKG_MGR="apt-get" ;;
  esac

  info "Detected OS: ${PRETTY_NAME:-$OS_ID}  (package manager: ${PKG_MGR})"
}

# ─── Check / install Docker ───────────────────────────────────────────────────
ensure_docker() {
  if command -v docker &>/dev/null; then
    success "Docker is already installed: $(docker --version)"
    return
  fi

  info "Docker not found — installing via get.docker.com …"
  curl -fsSL https://get.docker.com | sh
  sudo systemctl enable --now docker

  # Add current user to the docker group (takes effect on next login)
  if [[ -n "${SUDO_USER:-}" ]]; then
    sudo usermod -aG docker "${SUDO_USER}"
    warn "User '${SUDO_USER}' added to the 'docker' group. Log out and back in for this to take effect."
  fi

  success "Docker installed: $(docker --version)"
}

# ─── Ensure Docker Compose v2 is available ────────────────────────────────────
ensure_compose() {
  if docker compose version &>/dev/null 2>&1; then
    success "Docker Compose plugin available: $(docker compose version)"
    return
  fi

  info "Installing docker-compose-plugin …"
  case "${PKG_MGR}" in
    apt-get)
      sudo apt-get update -qq
      sudo apt-get install -y docker-compose-plugin
      ;;
    dnf)
      sudo dnf install -y docker-compose-plugin
      ;;
    *)
      error "Cannot install docker-compose-plugin automatically for ${PKG_MGR}. Please install it manually."
      ;;
  esac

  success "Docker Compose plugin installed: $(docker compose version)"
}

# ─── Locate project root (repo clone directory) ───────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/infrastructure/docker/docker-compose.yml"
ENV_EXAMPLE="${PROJECT_ROOT}/infrastructure/docker/.env.example"
ENV_FILE="${PROJECT_ROOT}/infrastructure/docker/.env"

# ─── Ensure docker-compose.yml exists ────────────────────────────────────────
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  error "docker-compose.yml not found at ${COMPOSE_FILE}"
fi

# ─── Copy .env.example → .env if needed ──────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f "${ENV_EXAMPLE}" ]]; then
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    success "Created ${ENV_FILE} from .env.example"
  else
    error ".env.example not found at ${ENV_EXAMPLE}"
  fi

  echo ""
  warn "ACTION REQUIRED: Edit ${ENV_FILE} and set your secrets before continuing."
  echo -e "  ${BOLD}Key variables to change:${RESET}"
  echo "    POSTGRES_PASSWORD   — strong random password"
  echo "    JWT_SECRET          — random 64-char string"
  echo "    ANTHROPIC_API_KEY   — your Anthropic key"
  echo "    STRIPE_SECRET_KEY   — your Stripe key"
  echo "    DOMAIN              — your domain name"
  echo ""
  read -rp "Have you edited .env and are ready to continue? [y/N] " confirm
  [[ "${confirm,,}" =~ ^y(es)?$ ]] || { warn "Aborted. Edit .env and re-run the script."; exit 0; }
else
  info ".env already exists at ${ENV_FILE} — skipping copy."
fi

# ─── Start services ───────────────────────────────────────────────────────────
info "Starting XP-Panel services …"
cd "${PROJECT_ROOT}/infrastructure/docker"
docker compose up -d --remove-orphans

success "All services started."

# ─── Show URLs ────────────────────────────────────────────────────────────────
# Attempt to read DOMAIN from .env; fall back to localhost
DOMAIN=$(grep -E '^DOMAIN=' "${ENV_FILE}" | cut -d= -f2 | tr -d '"' | tr -d "'")
DOMAIN="${DOMAIN:-localhost}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║           XP-Panel is running               ║${RESET}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}║${RESET}  Web UI    → https://${DOMAIN}"
echo -e "${BOLD}║${RESET}  API       → https://api.${DOMAIN}"
echo -e "${BOLD}║${RESET}  Logs      → docker compose logs -f"
echo -e "${BOLD}║${RESET}  Stop      → docker compose down"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  detect_os
  ensure_docker
  ensure_compose
}

main "$@"
