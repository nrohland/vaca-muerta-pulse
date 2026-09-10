#!/usr/bin/env python3
"""Compare CKAN DataStore `total` vs BigQuery COUNT(*) + print layout.

No secrets printed. Uses GOOGLE_APPLICATION_CREDENTIALS / ADC and public CKAN.

Env:
  BIGQUERY_PROJECT / --project
  BIGQUERY_DATASET / --dataset  (default raw_cap4_dev)
  BIGQUERY_LOCATION             (default US)
  TAP_CKAN_DATASTORE_PRODUCCION_RESOURCE_ID / --resource-id
"""
from __future__ import annotations

import argparse
import os
import sys

import requests
from google.cloud import bigquery

TABLE = "produccion_pozo_mes"
DEFAULT_RESOURCE = "d774b5d7-0756-48fe-88f2-8729b57b22da"
CKAN_URL = "https://datos.energia.gob.ar/api/3/action/datastore_search"


def datastore_total(resource_id: str) -> int:
    resp = requests.get(
        CKAN_URL,
        params={"resource_id": resource_id, "limit": 0},
        timeout=120,
    )
    resp.raise_for_status()
    payload = resp.json()
    if not payload.get("success"):
        raise RuntimeError(f"CKAN datastore_search failed: {payload}")
    return int(payload["result"]["total"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", default=os.environ.get("BIGQUERY_DATASET", "raw_cap4_dev"))
    parser.add_argument("--project", default=os.environ.get("BIGQUERY_PROJECT"))
    parser.add_argument("--location", default=os.environ.get("BIGQUERY_LOCATION", "US"))
    parser.add_argument(
        "--resource-id",
        default=os.environ.get("TAP_CKAN_DATASTORE_PRODUCCION_RESOURCE_ID", DEFAULT_RESOURCE),
    )
    args = parser.parse_args()
    if not args.project:
        print("ERROR: --project or BIGQUERY_PROJECT is required", file=sys.stderr)
        return 2

    source_total = datastore_total(args.resource_id)
    print(f"[compare] datastore resource={args.resource_id} total={source_total}")

    client = bigquery.Client(project=args.project, location=args.location)
    table_id = f"{args.project}.{args.dataset}.{TABLE}"
    count = list(client.query(f"SELECT COUNT(*) AS row_count FROM `{table_id}`").result())[0].row_count
    delta = int(count) - source_total
    print(f"[compare] bq {args.dataset}.{TABLE} count={count}")
    print(f"[compare] delta (bq - datastore)={delta}")

    ddl_sql = f"""
        SELECT table_name, ddl
        FROM `{args.project}.{args.dataset}.INFORMATION_SCHEMA.TABLES`
        WHERE table_name = @table
    """
    cfg = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("table", "STRING", TABLE)]
    )
    ddl_rows = list(client.query(ddl_sql, job_config=cfg).result())
    if ddl_rows:
        ddl = ddl_rows[0].ddl
        for needle in (
            "PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)",
            "CLUSTER BY empresa, idpozo, cuenca",
        ):
            print(f"[compare] ddl contains {needle!r}: {needle in ddl}")
    else:
        print("[compare] INFORMATION_SCHEMA.TABLES: no ddl row", file=sys.stderr)

    table = client.get_table(table_id)
    tp = table.time_partitioning
    print(
        f"[compare] table API partition_type={getattr(tp, 'type_', None)} "
        f"partition_field={getattr(tp, 'field', None)} "
        f"clustering={list(table.clustering_fields or [])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
