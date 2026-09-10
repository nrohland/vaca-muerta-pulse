# Evidencia — Hito 2 BigQuery IAM + datasets

Reverify: **2026-09-10** (post secret `GCP_SA_KEY_DBT` + SA creada por Nico). Actor dbt: `vm-pulse-dbt@$BIGQUERY_PROJECT.iam.gserviceaccount.com`. Location: **US**.

No se corrió `dbt`. No hay `COUNT(*)` ni scan de `produccion_pozo_mes`. Cero JSON de SA en git.

## Datasets

| Dataset | Location | Created (UTC) | Resultado |
| --- | --- | --- | --- |
| `raw_cap4_dev` | US | 2026-09-10 18:11:40 | existe (Hito 1) |
| `raw_cap4` | — | — | **no existe** |
| `stg_cap4_dev` | US | 2026-09-10 21:08:59 | existe |
| `int_cap4_dev` | US | 2026-09-10 21:09:00 | existe |
| `marts_cap4_dev` | US | 2026-09-10 21:09:00 | existe |

## Service account `vm-pulse-dbt`

**Existe.** Auth OK con secret `GCP_SA_KEY_DBT` (JSON completo; materializado a `transform/.secrets/vm-pulse-dbt.json`, gitignored). Distinto de `GCP_SA_KEY` (Meltano).

IAM API / Cloud Resource Manager API siguen **apagadas** para estas SAs (no se puede `gcloud iam` / `setIamPolicy` de proyecto desde acá). El `jobUser` de proyecto se evidencia porque `vm-pulse-dbt` corre un job de metadata.

## Roles verificados (2026-09-10)

ACL de dataset (equivalente BQ: READER = `dataViewer`, WRITER = `dataEditor`). Grant hecho por Meltano SA (**OWNER** de los datasets).

| Scope | Rol | Evidencia |
| --- | --- | --- |
| Proyecto | `bigquery.jobUser` | `INFORMATION_SCHEMA.SCHEMATA` (region-us) OK |
| `raw_cap4_dev` | `dataViewer` (READER) | `list_tables` → `produccion_pozo_mes` (sin scan) |
| `stg_cap4_dev` | `dataEditor` (WRITER) | create+drop `_iam_smoke_hito2` (0 filas) |
| `int_cap4_dev` | `dataEditor` (WRITER) | create+drop `_iam_smoke_hito2` (0 filas) |
| `marts_cap4_dev` | `dataEditor` (WRITER) | create+drop `_iam_smoke_hito2` (0 filas) |
| `raw_cap4` | — | dataset no existe; grant cuando DE lo cree |

Meltano sigue OWNER de los datasets dbt (los creó). No escribe modelos ahí.

## Cursor Cloud / GitHub (menú de secrets)

Mismo flujo que Meltano:

1. Add secrets → `GCP_SA_KEY_DBT` = JSON **entero** (de `{` a `}`).
2. Opcional: `GCP_SA_CLIENT_EMAIL_DBT` si el secret es solo PEM.
3. `bash transform/scripts/materialize-dbt-sa-key.sh` escribe el JSON gitignored.

`materialize-dbt-sa-key.sh` **prioriza** `GCP_SA_KEY_DBT` aunque `GCP_SA_KEY` (Meltano) ya esté en el entorno.

## Reverify (metadata / smoke 0 filas)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(bash transform/scripts/materialize-dbt-sa-key.sh)"
python3 transform/scripts/provision_hito2_bq.py
```

No lee tablas de hecho. No crear keys en el repo.
