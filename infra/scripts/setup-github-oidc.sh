#!/usr/bin/env bash
# One-time setup of the GitHub Actions -> Azure OIDC connection for Seven Habits Tools.
#
# Creates (idempotently):
#   Azure  - resource group rg-<app>-github with user-assigned identity id-<app>-github
#          - federated credentials for the `prod` environment and pull requests
#          - subscription roles: Contributor, and Role Based Access Control Administrator
#            constrained (ABAC) to assigning only Key Vault Secrets User
#          - resource provider registrations used by infra/main.bicep
#   GitHub - environment `prod`, deployable from the main branch only
#          - repository variables AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID
#            (and DEPLOY_ENABLED=true with --enable-deploy)
#
# Requires: az (Owner, or Contributor + User Access Administrator, on the subscription)
# and gh (admin rights on the repository).
#
# Usage: infra/scripts/setup-github-oidc.sh [--subscription <id-or-name>] [--repo <owner/name>]
#          [--location <region>] [--enable-deploy] [--dry-run]
# Without --subscription you must type the active subscription name to confirm.
set -euo pipefail

REPO="samuelya/SevenHabitsTools"
APP_NAME="sevenhabitstools"
GITHUB_ENVIRONMENT="prod"
LOCATION="australiaeast"
SUBSCRIPTION=""
ENABLE_DEPLOY=false
DRY_RUN=false

OIDC_ISSUER="https://token.actions.githubusercontent.com"
OIDC_AUDIENCE="api://AzureADTokenExchange"
KV_SECRETS_USER_ROLE_ID="4633458b-17de-408a-b874-0445c86b69e6"
RBAC_ADMIN_ROLE_ID="f58310d9-a9f6-439a-9e8d-f62e7b41a168"
PROVIDERS="Microsoft.App Microsoft.OperationalInsights Microsoft.Insights Microsoft.KeyVault Microsoft.ManagedIdentity"

usage() { sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; }
log() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# Runs a mutating command, or prints it with --dry-run.
run() {
  if [[ "$DRY_RUN" == true ]]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --subscription) SUBSCRIPTION="${2:?--subscription needs a value}"; shift 2 ;;
    --repo) REPO="${2:?--repo needs a value}"; shift 2 ;;
    --location) LOCATION="${2:?--location needs a value}"; shift 2 ;;
    --enable-deploy) ENABLE_DEPLOY=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "--repo must look like owner/name"

CICD_RG="rg-${APP_NAME}-github"
IDENTITY_NAME="id-${APP_NAME}-github"

# ---------- Preflight ----------
command -v az >/dev/null || die "Azure CLI (az) is not installed"
command -v gh >/dev/null || die "GitHub CLI (gh) is not installed"
az account show >/dev/null 2>&1 || die "not logged in to Azure; run: az login"
gh auth status >/dev/null 2>&1 || die "not logged in to GitHub; run: gh auth login"

# Subscription guard: explicit --subscription, or type the active subscription name.
# Every az call below passes --subscription, so the CLI's default is never changed.
if [[ -n "$SUBSCRIPTION" ]]; then
  account="$(az account show --subscription "$SUBSCRIPTION" --query '[id, tenantId, name]' -o tsv 2>/dev/null)" \
    || die "subscription '${SUBSCRIPTION}' not found for the logged-in account"
else
  account="$(az account show --query '[id, tenantId, name]' -o tsv)"
fi
SUBSCRIPTION_ID="$(sed -n 1p <<<"$account")"
TENANT_ID="$(sed -n 2p <<<"$account")"
SUBSCRIPTION_NAME="$(sed -n 3p <<<"$account")"
SUBSCRIPTION_SCOPE="/subscriptions/${SUBSCRIPTION_ID}"

if [[ -z "$SUBSCRIPTION" ]]; then
  [[ -t 0 ]] || die "no --subscription given and no terminal to confirm '${SUBSCRIPTION_NAME}'"
  printf 'Active subscription: %s (%s)\nType its name to continue: ' "$SUBSCRIPTION_NAME" "$SUBSCRIPTION_ID"
  read -r confirm
  [[ "$confirm" == "$SUBSCRIPTION_NAME" ]] || die "subscription name did not match; aborting"
fi

[[ "$(gh api "repos/${REPO}" --jq .permissions.admin)" == true ]] \
  || die "gh user needs admin rights on ${REPO}"

# Repositories using immutable subject claims have a repo:owner@id/name@id prefix,
# so read the prefix from GitHub instead of assuming repo:owner/name.
oidc="$(gh api "repos/${REPO}/actions/oidc/customization/sub" \
  --jq '[(.use_default | tostring), (.sub_claim_prefix // "")] | join(" ")')"
use_default="${oidc%% *}"
sub_prefix="${oidc#* }"
[[ "$use_default" == true ]] \
  || die "${REPO} uses a custom OIDC subject template; create federated credentials manually"
sub_prefix="${sub_prefix:-repo:${REPO}}"
SUBJECT_ENVIRONMENT="${sub_prefix}:environment:${GITHUB_ENVIRONMENT}"
SUBJECT_PULL_REQUEST="${sub_prefix}:pull_request"

log "Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID}), tenant ${TENANT_ID}"
log "Repository:   ${REPO}"
log "Subjects:     ${SUBJECT_ENVIRONMENT}"
log "              ${SUBJECT_PULL_REQUEST}"
if [[ "$DRY_RUN" == true ]]; then log "Dry run: no changes will be made"; fi

# ---------- Azure: resource providers ----------
for ns in $PROVIDERS; do
  state="$(az provider show --subscription "$SUBSCRIPTION_ID" --namespace "$ns" \
    --query registrationState -o tsv 2>/dev/null || echo NotRegistered)"
  if [[ "$state" != Registered ]]; then
    log "Registering resource provider ${ns}"
    run az provider register --subscription "$SUBSCRIPTION_ID" --namespace "$ns" --output none
  fi
done

# ---------- Azure: identity ----------
log "Ensuring resource group ${CICD_RG} and identity ${IDENTITY_NAME}"
run az group create --subscription "$SUBSCRIPTION_ID" --name "$CICD_RG" --location "$LOCATION" \
  --tags "app=${APP_NAME}" purpose=github-actions managedBy=script --output none
run az identity create --subscription "$SUBSCRIPTION_ID" --resource-group "$CICD_RG" \
  --name "$IDENTITY_NAME" --location "$LOCATION" \
  --tags "app=${APP_NAME}" purpose=github-actions managedBy=script --output none

if identity="$(az identity show --subscription "$SUBSCRIPTION_ID" --resource-group "$CICD_RG" \
  --name "$IDENTITY_NAME" --query '[clientId, principalId]' -o tsv 2>/dev/null)"; then
  CLIENT_ID="$(sed -n 1p <<<"$identity")"
  PRINCIPAL_ID="$(sed -n 2p <<<"$identity")"
else
  # Only reachable in --dry-run before the identity exists.
  CLIENT_ID="<new-identity-client-id>"
  PRINCIPAL_ID=""
fi

# ---------- Azure: federated credentials ----------
# create is a PUT, so re-running updates the credential in place.
create_federated_credential() {
  log "Federated credential $1 -> $2"
  run az identity federated-credential create --subscription "$SUBSCRIPTION_ID" \
    --resource-group "$CICD_RG" --identity-name "$IDENTITY_NAME" --name "$1" \
    --issuer "$OIDC_ISSUER" --subject "$2" --audiences "$OIDC_AUDIENCE" --output none
}
create_federated_credential "github-environment-${GITHUB_ENVIRONMENT}" "$SUBJECT_ENVIRONMENT"
create_federated_credential "github-pull-request" "$SUBJECT_PULL_REQUEST"

# ---------- Azure: role assignments ----------
# RBAC Administrator may only create/delete assignments of Key Vault Secrets User.
RBAC_CONDITION="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${KV_SECRETS_USER_ROLE_ID}})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${KV_SECRETS_USER_ROLE_ID}}))"

# assign_role <label> <role name or id> [condition]
assign_role() {
  local label="$1" role="$2" condition="${3:-}" existing attempt
  if [[ -n "$PRINCIPAL_ID" ]]; then
    existing="$(az role assignment list --subscription "$SUBSCRIPTION_ID" --scope "$SUBSCRIPTION_SCOPE" \
      --role "$role" --query "[?principalId=='${PRINCIPAL_ID}' && scope=='${SUBSCRIPTION_SCOPE}'] | length(@)" -o tsv)"
    if [[ "$existing" != 0 ]]; then
      log "Role ${label} already assigned"
      return
    fi
  fi
  log "Assigning role ${label} on ${SUBSCRIPTION_SCOPE}"
  set -- az role assignment create --subscription "$SUBSCRIPTION_ID" \
    --assignee-object-id "${PRINCIPAL_ID:-<new-identity-principal-id>}" \
    --assignee-principal-type ServicePrincipal --role "$role" --scope "$SUBSCRIPTION_SCOPE" --output none
  if [[ -n "$condition" ]]; then
    set -- "$@" --condition "$condition" --condition-version 2.0
  fi
  if [[ "$DRY_RUN" == true ]]; then
    run "$@"
    return
  fi
  # A new identity can take a minute to replicate in Entra ID.
  for attempt in 1 2 3 4 5 6; do
    if "$@"; then return; fi
    log "Role assignment failed (attempt ${attempt}/6); retrying in 15s"
    sleep 15
  done
  die "could not assign role ${label}"
}
assign_role "Contributor" "Contributor"
assign_role "Role Based Access Control Administrator (Key Vault Secrets User only)" \
  "$RBAC_ADMIN_ROLE_ID" "$RBAC_CONDITION"

# ---------- GitHub: environment ----------
log "Ensuring GitHub environment ${GITHUB_ENVIRONMENT} (deployments from main only)"
run gh api -X PUT "repos/${REPO}/environments/${GITHUB_ENVIRONMENT}" --silent \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true"
# gh prints the error body to stdout on 404, so only trust output from a successful call.
if ! has_main_policy="$(gh api "repos/${REPO}/environments/${GITHUB_ENVIRONMENT}/deployment-branch-policies" \
  --jq '[.branch_policies[]? | select(.name == "main" and .type == "branch")] | length' 2>/dev/null)"; then
  has_main_policy=0
fi
if [[ "$has_main_policy" == 0 ]]; then
  run gh api -X POST "repos/${REPO}/environments/${GITHUB_ENVIRONMENT}/deployment-branch-policies" \
    --silent -f name=main -f type=branch
fi

# ---------- GitHub: repository variables ----------
# Repository-level (not environment-level) so job `if:` conditions can read them.
log "Setting repository variables"
run gh variable set AZURE_CLIENT_ID --repo "$REPO" --body "$CLIENT_ID"
run gh variable set AZURE_TENANT_ID --repo "$REPO" --body "$TENANT_ID"
run gh variable set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$SUBSCRIPTION_ID"
if [[ "$ENABLE_DEPLOY" == true ]]; then
  run gh variable set DEPLOY_ENABLED --repo "$REPO" --body true
fi

log "Done."
cat <<EOF

Next steps:
  1. Run the Infrastructure workflow (Actions > Infrastructure > Run workflow) to create
     rg-${APP_NAME}-${GITHUB_ENVIRONMENT}.
  2. After the first image push, make the ghcr.io packages sevenhabitstools-api and
     sevenhabitstools-web public.
  3. Re-run with --enable-deploy (or set DEPLOY_ENABLED=true) so the App workflow deploys.
EOF
