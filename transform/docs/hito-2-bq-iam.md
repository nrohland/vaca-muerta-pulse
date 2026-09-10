# Evidencia IAM Hito 2 — datasets BQ + SA dbt

Corrida de verificación **2026-09-10** contra el proyecto GCP de Hito 1 (`extraction/.env.example`) (location **US**), autenticando con la SA de Meltano `vm-pulse-meltano` (mismo patrón que Hito 1: `extraction/scripts/materialize-sa-key.sh` + `GCP_SA_KEY`). **No se commitearon secretos. No se creó la SA de dbt. No se corrió `dbt build`.**

Este documento es evidencia de warehouse + el bloqueo de IAM. El código de modelos dbt es otro PR (Hito 2 AE). Acá solo datasets / IAM.

## Resultado

| Check | Resultado (2026-09-10) |
| --- | --- |
| Auth SA `vm-pulse-meltano` | OK (ADC vía materialize Meltano) |
| `raw_cap4_dev` | **existe**, location **US**, created `2026-09-10T18:11:40Z`. Tabla `produccion_pozo_mes` |
| `raw_cap4` (prod) | **no existe** |
| `stg_cap4_dev` | **existe**, US, created `2026-09-10T21:08:59Z`, **0 tablas** |
| `int_cap4_dev` | **existe**, US, created `2026-09-10T21:09:00Z`, **0 tablas** |
| `marts_cap4_dev` | **existe**, US, created `2026-09-10T21:09:00Z`, **0 tablas** |
| Twins prod `stg_cap4` / `int_cap4` / `marts_cap4` | **no existen** (no se crean en este PR) |
| SA `vm-pulse-dbt` | **no se afirma que exista.** `iam.serviceAccounts.get` → HTTP **403**: IAM API *has not been used in this project / is disabled*. Meltano no puede habilitarla ni crear SAs |
| Key JSON dbt | **no existe** en el repo (y no se debe commitear) |

Descripción de los tres datasets dbt (API `datasets.get`): *Hito 2 dbt (dev). Created for AE; Meltano does not write here.*

## INFORMATION_SCHEMA.SCHEMATA (`region-us`)

```text
schema_name      location  creation_time
int_cap4_dev     US        2026-09-10T21:09:00.251000+00:00
marts_cap4_dev   US        2026-09-10T21:09:00.985000+00:00
raw_cap4_dev     US        2026-09-10T18:11:40.286000+00:00
stg_cap4_dev     US        2026-09-10T21:08:59.464000+00:00
```

`raw_cap4` no aparece (dataset prod todavía no creado).

## ACL observada (legacy access entries)

Los cuatro datasets listados tienen el mismo patrón:

| role | entity |
| --- | --- |
| WRITER | `projectWriters` |
| OWNER | `projectOwners` |
| OWNER | `vm-pulse-meltano@<project-id>.iam.gserviceaccount.com` |
| READER | `projectReaders` |

`vm-pulse-dbt` **no** está en el ACL. Meltano quedó OWNER de `stg_*` / `int_*` / `marts_*` porque esa SA creó los datasets; **no** debería escribir ahí. Nico puede sacar ese OWNER con `--tighten-acl` **después** de crear `vm-pulse-dbt`.

## Default table expiration

`default_table_expiration_ms = 5184000000` (**60 días**) en `raw_cap4_dev` y en los tres datasets dbt (default de proyecto al crear). Si dbt materializa tablas sin override, **caducan a los 60 días**. El provision script avisa; Nico puede pasar `--unset-table-expiration` sobre `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev` si quiere que persistan.

## Por qué este agente no crea la SA

1. `iam.googleapis.com` no está habilitada (o Meltano no puede ni consultarla: Service Usage 403).
2. Crear SA pide `iam.serviceAccounts.create` + IAM API. Meltano es write-only a `raw_*`.
3. Inventar “la SA ya está” rompería el DoD. Estado honesto: **datasets sí, SA no**.

## Qué tiene que hacer Nicolás

Desde una identidad **owner** (gcloud user, no `vm-pulse-meltano`):

```bash
cd transform
# opcional: ADC de tu user
# gcloud auth application-default login

# 1) Ver el mismo inventario (Meltano SA alcanza para --verify-only de datasets)
bash scripts/provision_hito2_bq.sh --verify-only

# 2) Crear SA + grants (falla a propósito con Meltano; tiene que ser Nico)
bash scripts/provision_hito2_bq.sh \
  --unset-table-expiration \
  --tighten-acl \
  --create-key .secrets/vm-pulse-dbt.json
```

Equivalente `gcloud` (si preferís consola / CLI):

```bash
PROJECT="${BIGQUERY_PROJECT:?copy from extraction/.env.example}"
gcloud services enable iam.googleapis.com --project="$PROJECT"

gcloud iam service-accounts create vm-pulse-dbt \
  --project="$PROJECT" \
  --display-name="Vaca Muerta Pulse dbt"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:vm-pulse-dbt@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Lectura raw (dev). dataEditor queda restringido a datasets dbt, no al proyecto.
# Dataset IAM legacy equivalente: READER en raw_cap4_dev, WRITER en stg/int/marts_cap4_dev.
# El script Python aplica esas ACL. Prod raw_cap4 todavía no existe: no se grants sobre un dataset fantasma.

mkdir -p transform/.secrets   # gitignored
gcloud iam service-accounts keys create transform/.secrets/vm-pulse-dbt.json \
  --iam-account="vm-pulse-dbt@$PROJECT.iam.gserviceaccount.com"
chmod 600 transform/.secrets/vm-pulse-dbt.json
```

### Secret `GCP_SA_KEY_DBT` (mismo patrón que Meltano)

Meltano usa el secret de repo **`GCP_SA_KEY`**. dbt usa **otro** secret: **`GCP_SA_KEY_DBT`**. No reutilizar la key de Meltano (roles distintos; Meltano no debe escribir marts).

1. Abrí el JSON descargado (el archivo **completo**, de `{` a `}`).
2. GitHub → Settings → Secrets and variables → Actions → New secret → nombre `GCP_SA_KEY_DBT`.
3. En runtime (Actions / Cloud Agent / laptop):

```bash
export GCP_SA_KEY_DBT='<contenido COMPLETO del .json de vm-pulse-dbt>'
export GOOGLE_APPLICATION_CREDENTIALS="$(bash transform/scripts/materialize-dbt-sa-key.sh)"
```

Si el store solo guarda el PEM: seteá también `GCP_SA_DBT_CLIENT_EMAIL=vm-pulse-dbt@<project-id>.iam.gserviceaccount.com` (o `BIGQUERY_PROJECT`; el script deriva el email documentado). **No** uses `GCP_SA_KEY` ni `GCP_SA_CLIENT_EMAIL` de Meltano.

Roles mínimos de `vm-pulse-dbt` (cuando exista):

| Alcance | Rol |
| --- | --- |
| Proyecto | `roles/bigquery.jobUser` |
| Dataset `raw_cap4_dev` | READER (`dataViewer` equivalente) |
| Datasets `stg_cap4_dev`, `int_cap4_dev`, `marts_cap4_dev` | WRITER (`dataEditor` equivalente) |
| `raw_cap4` / twins prod | no — esos datasets **no existen** hoy |

## Repro de esta evidencia (sin secretos en git)

```bash
# Meltano SA — solo lectura de datasets
export GOOGLE_APPLICATION_CREDENTIALS="$(bash extraction/scripts/materialize-sa-key.sh)"
bash transform/scripts/provision_hito2_bq.sh --verify-only
# exit 2 esperado mientras vm-pulse-dbt no exista / IAM API off
```

Queries usadas (sin PII, sin keys):

```sql
SELECT schema_name, location, creation_time
FROM `$BIGQUERY_PROJECT.region-us.INFORMATION_SCHEMA.SCHEMATA`
WHERE schema_name IN (
  'raw_cap4_dev', 'raw_cap4',
  'stg_cap4_dev', 'int_cap4_dev', 'marts_cap4_dev'
)
ORDER BY schema_name;
```

## Fuera de alcance (este PR)

- Modelos dbt / `dbt build` / tests contra warehouse
- Crear `raw_cap4` ni twins prod `stg_cap4` / `int_cap4` / `marts_cap4`
- Workflow GitHub de dbt
- Commitear JSON de SA
