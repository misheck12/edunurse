#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Create GitHub Actions environment secrets/variables from terminal using gh CLI.

Usage:
  deploy/setup-github-actions-env.sh [options]

Options:
  --repo <owner/name>           GitHub repository (default: current repo)
  --environment <name>          GitHub environment (default: production)
  --env-file <path>             Env file to source for optional vars (default: deploy/.env.server)
  --deploy-path <path>          Server app path (default: /var/www/livingilabs/edunurse)
  --ssh-key-file <path>         SSH private key file (default: ~/.ssh/id_rsa)
  --ssh-host <host>             SSH host (or SSH_HOST env)
  --ssh-user <user>             SSH user (or SSH_USER env)
  --ssh-port <port>             SSH port (or SSH_PORT env; default 22)
  --ghcr-username <user>        GHCR username (or GHCR_USERNAME env)
  --ghcr-token <token>          GHCR token (or GHCR_TOKEN env)
  --no-sync-env-keys            Do not sync each ENV key as a GitHub secret
  --help                        Show help

Required:
  SSH host/user/private key + GHCR token.
EOF
}

REPO="${REPO:-}"
ENVIRONMENT="${ENVIRONMENT:-production}"
ENV_FILE="${ENV_FILE:-deploy/.env.server}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/livingilabs/edunurse}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/id_rsa}"
SSH_HOST_VALUE="${SSH_HOST:-}"
SSH_USER_VALUE="${SSH_USER:-}"
SSH_PORT_VALUE="${SSH_PORT:-22}"
GHCR_USERNAME_VALUE="${GHCR_USERNAME:-}"
GHCR_TOKEN_VALUE="${GHCR_TOKEN:-}"
SYNC_ENV_KEYS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --environment) ENVIRONMENT="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --deploy-path) DEPLOY_PATH="$2"; shift 2 ;;
    --ssh-key-file) SSH_KEY_FILE="$2"; shift 2 ;;
    --ssh-host) SSH_HOST_VALUE="$2"; shift 2 ;;
    --ssh-user) SSH_USER_VALUE="$2"; shift 2 ;;
    --ssh-port) SSH_PORT_VALUE="$2"; shift 2 ;;
    --ghcr-username) GHCR_USERNAME_VALUE="$2"; shift 2 ;;
    --ghcr-token) GHCR_TOKEN_VALUE="$2"; shift 2 ;;
    --no-sync-env-keys) SYNC_ENV_KEYS=0; shift 1 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required: https://cli.github.com/"
  exit 1
fi

if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi
if [[ -z "$REPO" ]]; then
  echo "Could not resolve repo. Pass --repo owner/name."
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
else
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "SSH key file not found: $SSH_KEY_FILE"
  exit 1
fi

if [[ -z "$SSH_HOST_VALUE" || -z "$SSH_USER_VALUE" || -z "$GHCR_TOKEN_VALUE" ]]; then
  echo "Missing required values. Set SSH_HOST, SSH_USER, GHCR_TOKEN or pass flags."
  exit 1
fi

if [[ -z "$GHCR_USERNAME_VALUE" ]]; then
  GHCR_USERNAME_VALUE="$(gh api user -q .login 2>/dev/null || true)"
fi
if [[ -z "$GHCR_USERNAME_VALUE" ]]; then
  echo "Could not resolve GHCR username. Pass --ghcr-username."
  exit 1
fi

set_secret() {
  local name="$1"
  local value="$2"
  gh secret set "$name" --repo "$REPO" --env "$ENVIRONMENT" --body "$value" >/dev/null
  echo "Set secret: $name"
}

set_var() {
  local name="$1"
  local value="$2"
  gh variable set "$name" --repo "$REPO" --env "$ENVIRONMENT" --body "$value" >/dev/null
  echo "Set variable: $name"
}

set_optional_var_from_env() {
  local var_name="$1"
  local env_name="$2"
  local val="${!env_name:-}"
  if [[ -n "$val" ]]; then
    set_var "$var_name" "$val"
  fi
}

set_secret "SSH_HOST" "$SSH_HOST_VALUE"
set_secret "SSH_USER" "$SSH_USER_VALUE"
set_secret "SSH_PORT" "$SSH_PORT_VALUE"
set_secret "SERVER_HOST" "$SSH_HOST_VALUE"
set_secret "SERVER_USER" "$SSH_USER_VALUE"
set_secret "SSH_PRIVATE_KEY" "$(cat "$SSH_KEY_FILE")"
set_secret "GHCR_USERNAME" "$GHCR_USERNAME_VALUE"
set_secret "GHCR_TOKEN" "$GHCR_TOKEN_VALUE"
gh secret set "SERVER_ENV_FILE" --repo "$REPO" --env "$ENVIRONMENT" < "$ENV_FILE" >/dev/null
echo "Set secret: SERVER_ENV_FILE"

set_var "DEPLOY_PATH" "$DEPLOY_PATH"
set_optional_var_from_env "VITE_API_BASE_URL" "VITE_API_BASE_URL"
set_optional_var_from_env "VITE_GOOGLE_OAUTH_CLIENT_ID" "VITE_GOOGLE_OAUTH_CLIENT_ID"
set_optional_var_from_env "VITE_GOOGLE_OAUTH_REDIRECT_URI" "VITE_GOOGLE_OAUTH_REDIRECT_URI"

if [[ "$SYNC_ENV_KEYS" -eq 1 ]]; then
  while IFS= read -r raw || [[ -n "$raw" ]]; do
    line="${raw#"${raw%%[![:space:]]*}"}"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="$(echo "$key" | tr -d '[:space:]')"
    [[ -z "$key" ]] && continue
    gh secret set "$key" --repo "$REPO" --env "$ENVIRONMENT" --body "$value" >/dev/null
    echo "Synced env key as secret: $key"
  done < "$ENV_FILE"
fi

echo "Done. Repo: $REPO, environment: $ENVIRONMENT"
