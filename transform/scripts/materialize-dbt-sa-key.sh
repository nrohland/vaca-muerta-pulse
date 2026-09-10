#!/usr/bin/env bash
# Materialize the *dbt* SA key (not Meltano) into a gitignored file.
# Wraps extraction/scripts/materialize-sa-key.sh with dbt defaults.
#
# Inputs (priority):
#   GCP_SA_KEY_DBT         full JSON of vm-pulse-dbt (preferred)
#   GCP_SA_KEY_DBT_BASE64  base64 of that JSON
#
# NEVER use Meltano's GCP_SA_KEY / GCP_SA_KEY_BASE64. Those are a different SA.
# NEVER echo the key. NEVER commit the dest file.
set -euo pipefail

transform_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "${transform_dir}/.." && pwd)"
dest="${SA_KEY_PATH:-$transform_dir/.secrets/vm-pulse-dbt.json}"
project="${DBT_BIGQUERY_PROJECT:-${BIGQUERY_PROJECT:?set BIGQUERY_PROJECT}}"

if [[ -z "${GCP_SA_KEY_DBT:-}" && -z "${GCP_SA_KEY_DBT_BASE64:-}" ]]; then
  echo "[sa-key] ERROR: set GCP_SA_KEY_DBT (full JSON of vm-pulse-dbt) or GCP_SA_KEY_DBT_BASE64." >&2
  echo "[sa-key] Do not reuse Meltano GCP_SA_KEY." >&2
  exit 1
fi

# Hand off to the Meltano materialize helper using only the dbt secret.
# Unset Meltano vars so a leftover GCP_SA_KEY cannot leak into vm-pulse-dbt.json.
unset GCP_SA_KEY GCP_SA_KEY_BASE64 || true
if [[ -n "${GCP_SA_KEY_DBT:-}" ]]; then
  export GCP_SA_KEY="${GCP_SA_KEY_DBT}"
elif [[ -n "${GCP_SA_KEY_DBT_BASE64:-}" ]]; then
  export GCP_SA_KEY_BASE64="${GCP_SA_KEY_DBT_BASE64}"
fi

export SA_KEY_PATH="${dest}"
export BIGQUERY_PROJECT="${project}"
export GCP_SA_CLIENT_EMAIL="${GCP_SA_CLIENT_EMAIL_DBT:-vm-pulse-dbt@${project}.iam.gserviceaccount.com}"

exec bash "${repo_root}/extraction/scripts/materialize-sa-key.sh"
