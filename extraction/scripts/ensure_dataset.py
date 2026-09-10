#!/usr/bin/env python3
"""Idempotently ensure the target BigQuery dataset exists.

Reads GOOGLE_APPLICATION_CREDENTIALS (a service-account key path) plus:
  BIGQUERY_PROJECT   (default: vaca-muerta-pulse)
  BIGQUERY_LOCATION  (default: US)
  BIGQUERY_DATASET   (required, e.g. raw_cap4 or raw_cap4_dev)

Creating the dataset requires the SA to have dataset-create permission
(roles/bigquery.user or dataEditor at project scope). If you scope the SA to
dataEditor on an existing dataset only, pre-create the datasets once with:
  bq --location=US mk -d --data_location=US <project>:<dataset>
and skip this step.
"""
import os
import sys

from google.cloud import bigquery
from google.api_core.exceptions import NotFound, Forbidden


def main() -> int:
    project = os.environ.get("BIGQUERY_PROJECT", "vaca-muerta-pulse")
    location = os.environ.get("BIGQUERY_LOCATION", "US")
    dataset = os.environ.get("BIGQUERY_DATASET")
    if not dataset:
        print("ERROR: BIGQUERY_DATASET is required", file=sys.stderr)
        return 2

    client = bigquery.Client(project=project)
    dataset_id = f"{project}.{dataset}"
    try:
        client.get_dataset(dataset_id)
        print(f"[ensure_dataset] {dataset_id} already exists")
        return 0
    except NotFound:
        pass

    ref = bigquery.Dataset(dataset_id)
    ref.location = location
    try:
        client.create_dataset(ref, exists_ok=True)
        print(f"[ensure_dataset] created {dataset_id} in {location}")
        return 0
    except Forbidden as e:
        print(
            f"[ensure_dataset] ERROR: the service account cannot create "
            f"{dataset_id}. Grant roles/bigquery.user (project) or pre-create "
            f"the dataset with `bq mk`. Details: {e}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
