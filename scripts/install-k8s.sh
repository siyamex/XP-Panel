#!/usr/bin/env bash
# install-k8s.sh — Deploy XP-Panel to Kubernetes via Helm
# Usage: bash scripts/install-k8s.sh

set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

NAMESPACE="xp-panel"
RELEASE_NAME="xp-panel"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHART_DIR="${PROJECT_ROOT}/infrastructure/kubernetes/helm/xp-panel"

# ─── Prerequisite checks ──────────────────────────────────────────────────────
check_prerequisites() {
  info "Checking prerequisites …"

  if ! command -v kubectl &>/dev/null; then
    error "kubectl not found. Install it: https://kubernetes.io/docs/tasks/tools/"
  fi
  success "kubectl: $(kubectl version --client --short 2>/dev/null || kubectl version --client | head -1)"

  if ! command -v helm &>/dev/null; then
    error "helm not found. Install it: https://helm.sh/docs/intro/install/"
  fi
  success "helm: $(helm version --short)"

  if ! kubectl cluster-info &>/dev/null; then
    error "Cannot reach a Kubernetes cluster. Check your kubeconfig / context."
  fi
  success "Kubernetes cluster reachable: $(kubectl config current-context)"
}

# ─── Helm repo setup ──────────────────────────────────────────────────────────
setup_helm_repos() {
  info "Configuring Helm repositories …"

  helm repo add bitnami https://charts.bitnami.com/bitnami 2>/dev/null \
    && success "Bitnami repo added." \
    || info "Bitnami repo already present — skipping."

  helm repo update
  success "Helm repos updated."
}

# ─── Namespace ────────────────────────────────────────────────────────────────
ensure_namespace() {
  info "Ensuring namespace '${NAMESPACE}' exists …"
  kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
  success "Namespace '${NAMESPACE}' is ready."
}

# ─── Collect user input ───────────────────────────────────────────────────────
prompt_configuration() {
  echo ""
  echo -e "${BOLD}── XP-Panel Helm Installation ──────────────────────────────${RESET}"
  echo ""

  # Domain
  read -rp "  Enter your domain (e.g. example.com) [xp-panel.io]: " INPUT_DOMAIN
  DOMAIN="${INPUT_DOMAIN:-xp-panel.io}"

  # JWT secret
  read -rp "  JWT secret (leave blank to auto-generate): " INPUT_JWT
  if [[ -z "${INPUT_JWT}" ]]; then
    JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)"
    info "Generated JWT secret."
  else
    JWT_SECRET="${INPUT_JWT}"
  fi

  # Database password
  read -rsp "  PostgreSQL password [changeme]: " INPUT_DB_PASS
  echo ""
  DB_PASS="${INPUT_DB_PASS:-changeme}"
  [[ "${DB_PASS}" == "changeme" ]] && warn "Using default DB password 'changeme' — change this in production!"

  # Stripe key (optional)
  read -rp "  Stripe secret key (optional, press Enter to skip): " INPUT_STRIPE
  STRIPE_KEY="${INPUT_STRIPE:-}"

  # Anthropic key (optional)
  read -rp "  Anthropic API key (optional, press Enter to skip): " INPUT_ANTHROPIC
  ANTHROPIC_KEY="${INPUT_ANTHROPIC:-}"

  echo ""
  info "Configuration summary:"
  echo "    Domain          : ${DOMAIN}"
  echo "    Namespace       : ${NAMESPACE}"
  echo "    Release name    : ${RELEASE_NAME}"
  echo "    Chart directory : ${CHART_DIR}"
  echo ""
  read -rp "  Proceed with installation? [y/N] " CONFIRM
  [[ "${CONFIRM,,}" =~ ^y(es)?$ ]] || { warn "Aborted."; exit 0; }
}

# ─── Create secrets ───────────────────────────────────────────────────────────
create_k8s_secrets() {
  info "Creating Kubernetes secrets …"

  kubectl create secret generic xp-panel-secrets \
    --namespace="${NAMESPACE}" \
    --from-literal=jwtSecret="${JWT_SECRET}" \
    --from-literal=stripeSecretKey="${STRIPE_KEY}" \
    --from-literal=anthropicApiKey="${ANTHROPIC_KEY}" \
    --dry-run=client -o yaml | kubectl apply -f -

  kubectl create secret generic xp-panel-db-secret \
    --namespace="${NAMESPACE}" \
    --from-literal=postgres-password="${DB_PASS}" \
    --from-literal=password="${DB_PASS}" \
    --dry-run=client -o yaml | kubectl apply -f -

  success "Secrets applied."
}

# ─── Helm install / upgrade ───────────────────────────────────────────────────
helm_deploy() {
  info "Running helm upgrade --install …"

  helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --set "ingress.hosts.api=api.${DOMAIN}" \
    --set "ingress.hosts.web=${DOMAIN}" \
    --set "ingress.tls.enabled=true" \
    --wait \
    --timeout 10m \
    --atomic

  success "Helm release '${RELEASE_NAME}' deployed."
}

# ─── Post-install status ──────────────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "${BOLD}── Deployed pods ────────────────────────────────────────────${RESET}"
  kubectl get pods -n "${NAMESPACE}"

  echo ""
  echo -e "${BOLD}── Services ─────────────────────────────────────────────────${RESET}"
  kubectl get svc -n "${NAMESPACE}"

  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║         XP-Panel deployed to Kubernetes                 ║${RESET}"
  echo -e "${BOLD}╠══════════════════════════════════════════════════════════╣${RESET}"
  echo -e "${BOLD}║${RESET}  Web UI  → https://${DOMAIN}"
  echo -e "${BOLD}║${RESET}  API     → https://api.${DOMAIN}"
  echo -e "${BOLD}║${RESET}"
  echo -e "${BOLD}║${RESET}  Useful commands:"
  echo -e "${BOLD}║${RESET}    kubectl get pods -n ${NAMESPACE}"
  echo -e "${BOLD}║${RESET}    kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/instance=${RELEASE_NAME} -f"
  echo -e "${BOLD}║${RESET}    helm status ${RELEASE_NAME} -n ${NAMESPACE}"
  echo -e "${BOLD}║${RESET}    helm uninstall ${RELEASE_NAME} -n ${NAMESPACE}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  check_prerequisites
  setup_helm_repos
  prompt_configuration
  ensure_namespace
  create_k8s_secrets
  helm_deploy
  show_status
}

main "$@"
