#!/usr/bin/env bash
# Provision Hito 2 BigQuery IAM + datasets for dbt.
# Run as Nicolás (project owner) — the Meltano SA cannot enable IAM APIs
# or create service accounts.
#
# Does NOT create or print a key. If you need a JSON for laptop/CI, create
# it locally and store it as GitHub secret GCP_SA_KEY_DBT (not GCP_SA_KEY).
set -euo pipefail

PROJECT="${DBT_BIGQUERY_PROJECT:-${BIGQUERY_PROJECT:?set BIGQUERY_PROJECT}}"
LOCATION="${BIGQUERY_LOCATION:-US}"
SA_ID="vm-pulse-dbt"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"

echo "[hito2] project=${PROJECT} location=${LOCATION} sa=${SA_EMAIL}"

echo "[hito2] enable IAM + Resource Manager APIs"
gcloud services enable \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="${PROJECT}"

echo "[hito2] create SA if missing"
if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "[hito2] SA already exists"
else
  gcloud iam service-accounts create "${SA_ID}" \
    --project="${PROJECT}" \
    --display-name="vm-pulse-dbt" \
    --description="Hito 2 dbt: read raw_*, write stg/int/marts. Not Meltano."
fi

echo "[hito2] project role bigquery.jobUser"
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" \
  --condition=None

echo "[hito2] datasets US (IF NOT EXISTS)"
for ds in stg_cap4_dev int_cap4_dev marts_cap4_dev; do
  if bq --project_id="${PROJECT}" ls -d "${PROJECT}:${ds}" >/dev/null 2>&1; then
    echo "[hito2] dataset ${ds} exists"
  else
    bq --location="${LOCATION}" mk -d --data_location="${LOCATION}" \
      --description="Hito 2 dbt (dev). Meltano does not write here." \
      "${PROJECT}:${ds}"
  fi
done

echo "[hito2] dataset IAM"
if bq --project_id="${PROJECT}" ls -d "${PROJECT}:raw_cap4_dev" >/dev/null 2>&1; then
  bq add-iam-policy-binding \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/bigquery.dataViewer" \
    "${PROJECT}:raw_cap4_dev"
else
  echo "[hito2] skip raw_cap4_dev (missing)"
fi
if bq --project_id="${PROJECT}" ls -d "${PROJECT}:raw_cap4" >/dev/null 2>&1; then
  bq add-iam-policy-binding \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/bigquery.dataViewer" \
    "${PROJECT}:raw_cap4"
else
  echo "[hito2] skip raw_cap4 (does not exist yet)"
fi
for ds in stg_cap4_dev int_cap4_dev marts_cap4_dev; do
  bq add-iam-policy-binding \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/bigquery.dataEditor" \
    "${PROJECT}:${ds}"
done

echo "[hito2] done. Do NOT run: gcloud iam service-accounts keys create"
echo "[hito2] If you need a key: create it outside git, store GCP_SA_KEY_DBT in GH Secrets."
