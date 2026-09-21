#!/usr/bin/env python3
"""Load Adjunto IV from CKAN DataStore into BigQuery (full resource, ~4890 rows).

Use this when Meltano GCP_SA_KEY is not available. The Meltano job
`cap4-fracturas` is the documented DE path; this script is the same
bounded load with Application Default Credentials / GCP_SA_KEY_DBT.

Does not dump CSV to git. Pulse filter lives in dbt, not here.

Requires the table from prepare_fracturas_load.py (WRITE_APPEND).
Do not WRITE_TRUNCATE: that would drop MONTH+_sdc_batched_at+cluster.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
from google.cloud import bigquery
from google.oauth2 import service_account

RESOURCE_ID = "2280ad92-6ed3-403e-a095-50139863ab0d"
DATASTORE_URL = "https://datos.energia.gob.ar/api/3/action/datastore_search"
PAGE_SIZE = 1000

# Catalog: extraction/catalogs/fracturas_adjunto_iv.fields.json
INT_COLS = (
    "id_base_fractura_adjiv",
    "idpozo",
    "cantidad_fracturas",
    "anio_if",
    "mes_if",
    "anio_ff",
    "mes_ff",
    "anio_carga",
    "mes_carga",
    "anio",
    "mes",
)
NUMERIC_COLS = (
    "longitud_rama_horizontal_m",
    "arena_bombeada_nacional_tn",
    "arena_bombeada_importada_tn",
    "agua_inyectada_m3",
    "co2_inyectado_m3",
    "presion_maxima_psi",
    "potencia_equipos_fractura_hp",
)
TIMESTAMP_COLS = ("fecha_inicio_fractura", "fecha_fin_fractura", "fecha_data")
KEEP_COLS = (
    "id_base_fractura_adjiv",
    "idpozo",
    "sigla",
    "cuenca",
    "areapermisoconcesion",
    "yacimiento",
    "formacion_productiva",
    "tipo_reservorio",
    "subtipo_reservorio",
    "longitud_rama_horizontal_m",
    "cantidad_fracturas",
    "tipo_terminacion",
    "arena_bombeada_nacional_tn",
    "arena_bombeada_importada_tn",
    "agua_inyectada_m3",
    "co2_inyectado_m3",
    "presion_maxima_psi",
    "potencia_equipos_fractura_hp",
    "fecha_inicio_fractura",
    "fecha_fin_fractura",
    "fecha_data",
    "anio_if",
    "mes_if",
    "anio_ff",
    "mes_ff",
    "anio_carga",
    "mes_carga",
    "empresa_informante",
    "mes",
    "anio",
    "periodo",
    "_sdc_extracted_at",
    "_sdc_batched_at",
)


def _client() -> bigquery.Client:
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get(
        "GCP_SA_KEY_DBT"
    )
    project = os.environ.get("GCP_PROJECT") or os.environ.get("BIGQUERY_PROJECT")
    location = os.environ.get("BIGQUERY_LOCATION", "US")
    if not project:
        raise SystemExit("Set GCP_PROJECT or BIGQUERY_PROJECT")
    if path and Path(path).is_file():
        creds = service_account.Credentials.from_service_account_file(path)
        return bigquery.Client(project=project, credentials=creds, location=location)
    return bigquery.Client(project=project, location=location)


def fetch_all() -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        response = requests.get(
            DATASTORE_URL,
            params={"resource_id": RESOURCE_ID, "limit": PAGE_SIZE, "offset": offset},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(payload)
        batch = payload["result"]["records"]
        if not batch:
            break
        rows.extend(batch)
        offset += len(batch)
        print(f"fetched {len(rows)}/{payload['result'].get('total')}", flush=True)
        if len(batch) < PAGE_SIZE:
            break
    return rows


def to_frame(records: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    df = df.drop(columns=["_id", "_full_text"], errors="ignore")
    for col in INT_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    for col in TIMESTAMP_COLS:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
    anio = pd.to_numeric(df.get("anio"), errors="coerce")
    mes = pd.to_numeric(df.get("mes"), errors="coerce")
    df["periodo"] = pd.to_datetime(
        {"year": anio, "month": mes, "day": 1}, errors="coerce"
    ).dt.date
    now = datetime.now(timezone.utc)
    df["_sdc_extracted_at"] = now
    df["_sdc_batched_at"] = now
    present = [c for c in KEEP_COLS if c in df.columns]
    return df[present]


def main() -> int:
    dataset = os.environ.get("BQ_RAW_DATASET") or os.environ.get(
        "BIGQUERY_DATASET", "raw_cap4_dev"
    )
    project = os.environ.get("GCP_PROJECT") or os.environ.get("BIGQUERY_PROJECT")
    table_id = f"{project}.{dataset}.fracturas_adjunto_iv"

    records = fetch_all()
    df = to_frame(records)
    print(
        f"rows={len(df)} unique_pk={df['id_base_fractura_adjiv'].nunique()}",
        flush=True,
    )

    client = _client()
    try:
        client.get_table(table_id)
    except Exception as exc:  # noqa: BLE001 — surface missing pre-create clearly
        print(
            f"ERROR: {table_id} missing. Run prepare_fracturas_load.py first ({exc})",
            file=sys.stderr,
        )
        return 1

    job = client.load_table_from_dataframe(
        df,
        table_id,
        job_config=bigquery.LoadJobConfig(write_disposition="WRITE_APPEND"),
    )
    job.result()
    table = client.get_table(table_id)
    print(json.dumps({"table": table_id, "num_rows": table.num_rows, "job": job.job_id}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
