#!/usr/bin/env bash
# Materialize the *dbt* SA key (not Meltano) into a gitignored file.
# Wraps extraction/scripts/materialize-sa-key.sh with dbt defaults.
#
# Inputs (priority):
#   GCP_SA_KEY_DBT        full JSON of vm-pulse-dbt (preferred)
#   GCP_SA_KEY            accepted if you already exported the dbt JSON here
#   GCP_SA_KEY_BASE64     base64 of that JSON
#
# NEVER echo the key. NEVER commit the dest file.
set -euo pipefail

transform_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "${transform_dir}/.." && pwd)"
dest="${SA_KEY_PATH:-$transform_dir/.secrets/vm-pulse-dbt.json}"
project="${DBT_BIGQUERY_PROJECT:-${BIGQUERY_PROJECT:?set BIGQUERY_PROJECT}}"

# Prefer the dbt secret even if Meltano's GCP_SA_KEY is already in the env.
if [[ -n "${GCP_SA_KEY_DBT:-}" ]]; then
  export GCP_SA_KEY="${GCP_SA_KEY_DBT}"
fi

export SA_KEY_PATH="${dest}"
export BIGQUERY_PROJECT="${project}"
export GCP_SA_CLIENT_EMAIL="${GCP_SA_CLIENT_EMAIL_DBT:-${GCP_SA_CLIENT_EMAIL:-vm-pulse-dbt@${project}.iam.gserviceaccount.com}}"

exec bash "${repo_root}/extraction/scripts/materialize-sa-key.sh"
