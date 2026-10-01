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
import re
from pathlib import Path
import yaml

import requests
from google.cloud import bigquery

TABLE = "produccion_pozo_mes"
DEFAULT_RESOURCE = "d774b5d7-0756-48fe-88f2-8729b57b22da"
CKAN_URL = "https://datos.energia.gob.ar/api/3/action/datastore_search"


def datastore_total(resource_id: str) -> int:
    resp = requests.get(
        CKAN_URL,
        params={"resource_id": resource_id, "limit": 0, "include_total": True},
        timeout=120,
    )
    resp.raise_for_status()
    payload = resp.json()
    if not payload.get("success"):
        raise RuntimeError("CKAN datastore_search failed")
    if payload["result"].get("total_was_estimated"):
        raise ValueError("Exact CKAN count required")
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
    parser.add_argument("--year", type=int, required=True, help="Year represented by the annual source resource")
    args = parser.parse_args()
    if not 1 <= args.year <= 9999 or not re.fullmatch(r"[A-Za-z0-9_-]+", args.dataset) or (args.project and not re.fullmatch(r"[A-Za-z0-9_-]+", args.project)):
        parser.error("Invalid year, project or dataset")
    if not args.project:
        print("ERROR: --project or BIGQUERY_PROJECT is required", file=sys.stderr)
        return 2

    resources = yaml.safe_load((Path(__file__).resolve().parents[1] / "resources/cap4.yml").read_text())
    chosen = {}
    for entry in resources["produccion_anual"]:
        chosen.setdefault(entry["year"], entry["resource_id"])
    if chosen.get(args.year) != args.resource_id:
        parser.error("Resource/year must match the reviewed annual catalog")
    source_total = datastore_total(args.resource_id)
    print(f"[compare] datastore resource={args.resource_id} total={source_total}")

    client = bigquery.Client(project=args.project, location=args.location)
    table_id = f"{args.project}.{args.dataset}.{TABLE}"
    count_cfg = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("year", "INT64", args.year)], maximum_bytes_billed=1024**3)
    count = list(client.query(f"SELECT COUNT(*) AS row_count FROM `{table_id}` WHERE anio = @year", job_config=count_cfg).result())[0].row_count
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
    print(
        f"[compare] tables.get num_rows={table.num_rows} num_bytes={table.num_bytes}"
    )
    buf = table.streaming_buffer
    if buf is not None:
        print(
            f"[compare] streaming_buffer estimated_rows={buf.estimated_rows} "
            f"estimated_bytes={buf.estimated_bytes}"
        )
    else:
        print("[compare] streaming_buffer: none")

    part_sql = f"""
        SELECT partition_id, total_rows, total_logical_bytes
        FROM `{args.project}.{args.dataset}.INFORMATION_SCHEMA.PARTITIONS`
        WHERE table_name = @table
        ORDER BY partition_id
    """
    try:
        parts = list(client.query(part_sql, job_config=cfg).result())
        if not parts:
            print("[compare] INFORMATION_SCHEMA.PARTITIONS: (empty)")
        for p in parts:
            print(
                f"[compare] partition_id={p.partition_id} total_rows={p.total_rows} "
                f"total_logical_bytes={p.total_logical_bytes}"
            )
    except Exception as exc:
        print(f"[compare] INFORMATION_SCHEMA.PARTITIONS unavailable: {exc}")

    staging_sql = f"""
        SELECT table_name
        FROM `{args.project}.{args.dataset}.INFORMATION_SCHEMA.TABLES`
        WHERE table_name LIKE 'produccion_pozo_mes__%'
        ORDER BY table_name
    """
    staging = [r.table_name for r in client.query(staging_sql).result()]
    print(f"[compare] staging_tables={staging or '(none)'}")
    layout_ok = (getattr(tp, 'type_', None) == 'MONTH'
                 and getattr(tp, 'field', None) == '_sdc_batched_at'
                 and list(table.clustering_fields or []) == ['empresa', 'idpozo', 'cuenca'])
    return 0 if delta == 0 and layout_ok and not staging else 1


if __name__ == "__main__":
    raise SystemExit(main())
