#!/usr/bin/env bash
# Wrapper for provision_hito2_bq.py — Hito 2 datasets + vm-pulse-dbt SA.
#
# Who runs this: Nicolás (GCP owner / IAM admin).
# The Meltano SA cannot enable iam.googleapis.com or create service accounts.
#
# Never prints key material. --create-key writes a gitignored JSON; do not commit it.
#
# Examples:
#   bash transform/scripts/provision_hito2_bq.sh --verify-only
#   bash transform/scripts/provision_hito2_bq.sh --dry-run
#   bash transform/scripts/provision_hito2_bq.sh --unset-table-expiration --tighten-acl
#   bash transform/scripts/provision_hito2_bq.sh --create-key transform/.secrets/vm-pulse-dbt.json
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[provision] ERROR: python3 is required" >&2
  exit 1
fi

# google-cloud-bigquery is already used by extraction/. Offer a hint, don't pip-install blindly.
if ! python3 -c "import google.cloud.bigquery, google.auth" 2>/dev/null; then
  echo "[provision] ERROR: need google-cloud-bigquery + google-auth." >&2
  echo "  pip install google-cloud-bigquery google-auth" >&2
  exit 1
fi

exec python3 "$script_dir/provision_hito2_bq.py" "$@"
