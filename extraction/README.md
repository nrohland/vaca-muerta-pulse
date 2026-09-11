# extraction/ — Meltano (Data Engineer)

**Hito 1.** Ingesta Capítulo IV → BigQuery `raw_*`. Owner: **DE**. No hay dbt ni dashboard acá.

Proyecto Meltano **adentro de este folder** (no en la raíz del git). Tap: Singer SDK contra el **CKAN DataStore** de [datos.energia.gob.ar](https://datos.energia.gob.ar) (API oficial, **sin** scraper del HTML de consulta avanzada). Loader: `target-bigquery` (z3z1ma).

---

## Prereqs

- Python **3.10+** (probado el scaffold con 3.12)
- `make` (opcional) o Meltano 4.2.2 vía venv
- Proyecto GCP `vaca-muerta-pulse` con BigQuery API (ver [GCP](#gcp-proyecto-iam-y-plata))
- Service account JSON **fuera de git**, o Application Default Credentials

```bash
cd extraction
python3 -m venv .venv
source .venv/bin/activate
pip install "meltano==4.2.2"
cp .env.example .env   # editá GOOGLE_APPLICATION_CREDENTIALS
meltano install
```

Equivalente: `make install` desde `extraction/`.

---

## Comando para copiar (`meltano run`)

Con el venv activado y `.env` apuntando al JSON de la SA:

```bash
cd extraction
source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/meltano-raw-writer.json

# Pre-create partitioned table (IF NOT EXISTS) + print INFORMATION_SCHEMA
python scripts/prepare_year_load.py --dataset raw_cap4_dev

# Dev: dataset raw_cap4_dev, append (overwrite:true está prohibido — ver Bug 1)
# Año completo 2025: NO setear TAP_CKAN_DATASTORE_MAX_RECORDS (~991_844 filas)
ALLOW_FULL_YEAR_LOAD=true MELTANO_ENVIRONMENT=dev meltano run cap4-produccion

# Dev reload de un año: TRUNCATE (conserva partition+cluster) y append
python scripts/prepare_year_load.py --dataset raw_cap4_dev --truncate
MELTANO_ENVIRONMENT=dev meltano run cap4-produccion

# Sandbox GCP (DML prohibido): DROP+CREATE con el mismo layout, después append
python scripts/prepare_year_load.py --dataset raw_cap4_dev --recreate
MELTANO_ENVIRONMENT=dev meltano run cap4-produccion

# Prod: dataset raw_cap4, append; re-emití el año con DELETE + append
python scripts/prepare_year_load.py --dataset raw_cap4 --delete-year 2025
MELTANO_ENVIRONMENT=prod meltano run cap4-produccion
```

Sin Makefile: el job `cap4-produccion` es `tap-ckan-datastore target-bigquery`.

Discover (sin BQ):

```bash
meltano invoke tap-ckan-datastore --discover
```

Tap chico en laptop (no es el smoke de un año):

```bash
TAP_CKAN_DATASTORE_MAX_RECORDS=50 meltano invoke tap-ckan-datastore
```

`make extract` / `make discover` delegan a esos comandos.

---

## Credenciales (SA) y ejecución en CI

El load a BigQuery necesita la **service account** de Meltano (roles: `bigquery.jobUser` + `bigquery.dataEditor` sobre el dataset raw; `+ bigquery.user` si querés que CI cree el dataset). La key JSON **nunca** va al repo. Hay tres formas de proveerla, todas terminan en `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un archivo:

### 1. Local (tu laptop)
```bash
cd extraction
mkdir -p .secrets                                   # .secrets/ está gitignored
cp /ruta/descargada/meltano-raw-writer.json .secrets/
cp .env.example .env                                # ya apunta a ./.secrets/meltano-raw-writer.json
source .venv/bin/activate
MELTANO_ENVIRONMENT=dev meltano run cap4-produccion
```

### 2. Desde un secret (GitHub Actions o Cursor Cloud)
No copiás un archivo: ponés el **JSON como secreto** y un script lo materializa en `.secrets/` en runtime.
```bash
export GCP_SA_KEY='<contenido COMPLETO del .json de la key>'   # o GCP_SA_KEY_BASE64=<base64>
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-sa-key.sh)"
```
> **Ojo (error común):** `GCP_SA_KEY` tiene que ser el **JSON entero** (de `{` a `}`), no solo el bloque `-----BEGIN PRIVATE KEY-----`. Si por lo que sea solo tenés la private key, seteá además `GCP_SA_CLIENT_EMAIL` (el email de la SA, `vm-pulse-meltano@<project-id>.iam.gserviceaccount.com`) y el script reconstruye el JSON.

### 3. GitHub Actions (todo el pipeline en CI)
Workflow: [`.github/workflows/extract-cap4.yml`](../.github/workflows/extract-cap4.yml).

- **`workflow_dispatch`** (manual): inputs `environment` / `year_resource_id` / `max_records` / `reemit` / `delete_year`.
- **`schedule` mensual:** `0 6 5 * *` (día 5, 06:00 UTC). Capítulo IV es **mensual**; Barrilito en UI es simulación, no hay polling de alta frecuencia. GitHub solo corre el cron en la rama default **después de merge**. El job **sale 1 antes de Meltano/BQ** hasta `ALLOW_FULL_YEAR_LOAD=true`. Nicolás OK el costo el 2026-09-10 (medido ~338 MiB); hay que **setear la variable** en el repo para que el cron no quede rojo. Cuando esté seteada: Meltano **`dev`** (`raw_cap4_dev`) + `TRUNCATE` (o `--recreate` en sandbox) + año completo. Prod: `workflow_dispatch` `environment=prod` + `reemit=true`.

Requisitos en el repo (Settings → Secrets and variables → Actions):

| Tipo | Nombre | Valor |
| --- | --- | --- |
| **Secret** | `GCP_SA_KEY` | JSON completo de la key de la SA |
| Variable (opcional) | `BIGQUERY_PROJECT` | default del `meltano.yml` |
| Variable (opcional) | `BIGQUERY_LOCATION` | default `US` |
| Variable (opcional) | `GCP_SA_CLIENT_EMAIL` | solo si `GCP_SA_KEY` trae únicamente la private key |
| Variable | `ALLOW_FULL_YEAR_LOAD` | `true` para schedule / dispatch sin `max_records`. Nicolás OK el costo 2026-09-10; hay que **setear** la variable (el OK no la prende solo). |

El workflow instala Meltano, materializa la key, asegura el dataset, corre `prepare_year_load.py` y `cap4-produccion` **solo si** el guardia deja pasar. Evidencia del año 2025: [docs/hito-1-full-year-2025-load.md](docs/hito-1-full-year-2025-load.md). Bytes / pricing: [docs/hito-1-full-year-cost.md](docs/hito-1-full-year-cost.md).

> **Alternativa sin key de larga vida:** Workload Identity Federation (`google-github-actions/auth` con `workload_identity_provider` + `service_account`, sin `GCP_SA_KEY`). Más seguro; pide configurar un WIF pool en GCP. Se puede migrar sin tocar Meltano.

---

## Por qué este tap (y no un scraper)

| Opción | Decisión |
| --- | --- |
| CKAN DataStore `datastore_search` | **Elegido.** `datastore_active: true` en los CSV anuales. Paginación `limit`/`offset`, schema tipado, resource UUID estable. Singer SDK (`plugins/tap-ckan-datastore`). |
| CSV anual por URL (`tap-spreadsheets-anywhere` / `tap-csv`) | Plan B si DataStore está truncado (ya pasó: el 2025 “con identificador” `6f9f63bd-…` tiene ~90k filas vs ~992k del anual `d774b5d7-…`). URLs en [resources/cap4.yml](resources/cap4.yml). |
| `tap-rest-api-msdk` genérico | Viable, pero el `total` de CKAN vive en `result.total` y el paginador offset default no es fiable. El tap chico envuelve esa semántica. |
| HTML consulta avanzada SE | **Prohibido** (spec / ADR). |

Default de Hito 1: **producción pozo-mes 2025**, resource `d774b5d7-0756-48fe-88f2-8729b57b22da` (Datastore total **991 844** al 2026-09-10). Streams `capitulo_iv_pozos` y `fracturas_adjunto_iv` existen en el tap y van **deseleccionados** en `meltano.yml`.

---

## GCP (proyecto, región, APIs, plata)

| | |
| --- | --- |
| Project id | `vaca-muerta-pulse` |
| BigQuery location | **US** (multi-region) |
| Dataset prod | `raw_cap4` |
| Dataset dev | `raw_cap4_dev` |

APIs mínimas a habilitar en el proyecto:

1. **BigQuery API** (`bigquery.googleapis.com`)
2. **BigQuery Storage API** (`bigquerystorage.googleapis.com`) — hace falta para `method: storage_write_api`
3. IAM (ya está en todo proyecto GCP) — no hace falta Cloud Composer ni GCS

**Billing / presupuesto:** Hito 1 asume free/cheap-tier. Creá un **budget alert** en Billing (p.ej. umbral 1 USD y 5 USD) para no sorprenderte si alguien hace un full scan. Load jobs batch a BQ son baratos; lo que come cuota es **query** sin predicado de partición. No dejes el dashboard (Hito 3) leyendo `raw_*`.

IAM de la SA de Meltano (write-only a raw):

- `roles/bigquery.jobUser` (correr el load job)
- `roles/bigquery.dataEditor` **restringido al dataset** `raw_cap4` / `raw_cap4_dev` (no `Editor` de proyecto)
- Sin `bigquery.dataViewer` sobre marts ajenos; sin keys en el repo

**Hito 2 — SA dbt (distinta):** `vm-pulse-dbt`. Lee `raw_*` (`dataViewer`), escribe `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev` (`dataEditor`), `jobUser` en el proyecto. **No** reutilices `GCP_SA_KEY`. Secret: `GCP_SA_KEY_DBT`. Evidencia: [transform/docs/hito-2-bq-iam.md](../transform/docs/hito-2-bq-iam.md).

Credenciales: `GOOGLE_APPLICATION_CREDENTIALS` (JSON path) o ADC. El target también lee `TARGET_BIGQUERY_CREDENTIALS_PATH`. **Nunca** `credentials_json` en `meltano.yml`.

Dataset: este PR **no** lo crea si no hay SA. Cuando exista credencial:

```bash
bq --location=US mk -d --data_location=US vaca-muerta-pulse:raw_cap4
bq --location=US mk -d --data_location=US vaca-muerta-pulse:raw_cap4_dev
```

---

## Diseño físico (producción pozo-mes)

### Nombres 1:1 con el tap

| Stream Singer | Tabla BQ |
| --- | --- |
| `produccion_pozo_mes` | `raw_cap4.produccion_pozo_mes` (prod) / `raw_cap4_dev.produccion_pozo_mes` (dev) |
| `capitulo_iv_pozos` | `…capitulo_iv_pozos` (no seleccionado) |
| `fracturas_adjunto_iv` | `…fracturas_adjunto_iv` (no seleccionado) |

El tap agrega `periodo` (`YYYY-MM-01`) desde `anio`+`mes`. No convierte m³→bbl.

### PARTITION

- **Intento de producto:** `PARTITION BY DATE(periodo)` — queries de “último año” sin scan 2006–hoy. Ver [sql/intended_partition.sql](sql/intended_partition.sql).
- **Lo que el loader cablea hoy:** `partition_granularity: month` sobre **`_sdc_batched_at`** (limitación de z3z1ma/target-bigquery). Handoff: la tabla existente ya tiene ese layout. Pre-create: [sql/create_produccion_pozo_mes.sql](sql/create_produccion_pozo_mes.sql). **No** afirmamos partición por `periodo`.

### CLUSTER BY (orden)

`empresa`, `idpozo`, `cuenca` — cableado en `meltano.yml` (`clustering_fields`). Coincide con filtros de storytelling (empresa / pozo / cuenca Neuquina). Máximo 4 columnas en BQ; `sigla` queda afuera a propósito (`idpozo` ya identifica formación productiva).

### Re-emit del CSV anual (Bug 1 — no usar overwrite)

El archivo del año es un **snapshot**. `rectificado` existe (`t`/`f`) pero en 2025 casi todo es `f`.

**Bug 1 (z3z1ma @090dad06):** `overwrite: true` escribe staging `produccion_pozo_mes__*` y al cerrar hace `CREATE OR REPLACE TABLE final AS SELECT *`. BigQuery responde `400 Cannot replace a table with a different partitioning spec (new=none, existing=month+_sdc_batched_at+cluster)`. Las filas quedan en staging; la tabla final queda en **0 filas**. El pin no se bumpa: el issue upstream es [z3z1ma/target-bigquery#134](https://github.com/z3z1ma/target-bigquery/issues/134) (fix #139 sin mergear). `0.7.2` hace DROP+CREATE (destruye el layout a menos que el CREATE lo recablee); acá se elige append + truncate/delete, que es además la semántica correcta de un CSV anual.

- **Siempre** `overwrite: false` (dev y prod). Pre-crear la tabla con [sql/create_produccion_pozo_mes.sql](sql/create_produccion_pozo_mes.sql) / `scripts/prepare_year_load.py`.
- **dev (un año):** `TRUNCATE TABLE` (conserva MONTH + CLUSTER) y volver a correr Meltano. Equiv: `--truncate`.
- **prod (histórico multi-año):** `DELETE WHERE anio = @year` y volver a correr el job con el resource de ese año ([sql/reemit_year.sql](sql/reemit_year.sql) / `--delete-year`).
- No `MERGE`/`upsert` en Hito 1: la clave `idpozo+anio+mes` es única en el sample 2025, falta repetir el test en otros años (Hito 2).
- Si un run viejo dejó staging llena y final en 0: [sql/promote_staging.sql](sql/promote_staging.sql) (one-shot). Preferí un meltano run nuevo con este PR.

### Throughput (Bug 2)

500 filas con `method: batch_job` + `denormalized: true` tardaron ≈ 8.5 min (~1 rec/s). Un año (~992k) no es viable a esa tasa.

| Setting | Antes (roto) | Ahora |
| --- | --- | --- |
| `method` | `batch_job` (LoadJob por batch, latencia alta) | `storage_write_api` (default stream; soportado en este pin) |
| `batch_size` / `batch_size_rows` | 100000 (y el SDK igual podía flushar batches chicos) | **500** (límite de protobuf del Storage Write API) |
| `denormalized` | `true` | `true` (columnas tipadas para Hito 2; no JSON blob) |
| `overwrite` | `true` en dev | `false` |

Smoke 500–5000 filas: debería terminar en **minutos**, no en ~1 rec/s. Año completo: CKAN pagina a 32k (≈31 requests) y el loader manda batches de 500 por el Storage Write API; esperable **decenas de minutos**, no ~10 días. Si Storage API no está habilitada, el job falla al autenticar el write stream — habilitala; no vuelvas a `batch_job` sin medir.

Overrides puntuales (sin tocar el yaml): `TARGET_BIGQUERY_METHOD`, `TARGET_BIGQUERY_BATCH_SIZE`, `TAP_CKAN_DATASTORE_MAX_RECORDS`.

---

## Resource IDs / URLs (producción por año)

Catálogo versionado: [resources/cap4.yml](resources/cap4.yml).

- Package: [`produccion-de-petroleo-y-gas-por-pozo`](https://datos.energia.gob.ar/dataset/produccion-de-petroleo-y-gas-por-pozo) (`c846e79c-026c-4040-897f-1ad3543b407c`)
- Mirror datos.gob.ar: [energia-produccion-petroleo-gas-por-pozo-capitulo-iv](https://datos.gob.ar/dataset/energia-produccion-petroleo-gas-por-pozo-capitulo-iv)
- API: `https://datos.energia.gob.ar/api/3/action/datastore_search?resource_id=<uuid>&limit=5`

| Año | resource_id (extract anual default) |
| --- | --- |
| 2026 (YTD) | `fb7a47a0-cba9-4667-a004-6f6c1c346c23` |
| **2025 (default smoke)** | `d774b5d7-0756-48fe-88f2-8729b57b22da` |
| 2024 | `43a09dce-1742-44d0-bc13-f193deaab563` |
| 2023 | `231c39b3-e81e-4398-af8d-b115807f2c25` |
| 2022 | `876b3746-85e2-4039-adeb-b1354436159f` |
| 2021 | `465be754-a372-4c31-b855-81dc5fe3309f` |
| 2020 | `c4a4a6a0-e75a-4e12-ae5c-54d53a70348c` |
| 2019–2006 | ver `resources/cap4.yml` |

CSV directo (mismo UUID):  
`https://datos.energia.gob.ar/dataset/c846e79c-026c-4040-897f-1ad3543b407c/resource/<uuid>/download/`

Hay una familia paralela **DDJJ abiertas y cerradas** (otro UUID por año) — no es el default de Hito 1.

---

## Padrón y completaciones (descubrimiento)

**¿El CSV de producción ya trae dims de pozo?** Sí, para el hecho de storytelling: `empresa`, `idempresa`, `sigla`, `idpozo`, `formacion`, `formprod`, `areapermisoconcesion`, `areayacimiento`, `cuenca`, `provincia`, `tipopozo`, `profundidad`, `tipo_de_recurso`, `sub_tipo_recurso`. **No** trae coordenadas.

**Padrón aparte:** `Capítulo IV - Pozos` `cb5c0f04-7835-45cd-b982-3e25ca7d7751` (geojson / geom, fechas Adjunto IV de perf/terminación). El recurso “padrón con fecha de primera producción” `5578dd48-…` es solo `(idpozo, anio, mes)`. **Tap extra no entra en el `meltano run` default** — Hito 1 no lo carga; Hito 2 arma `dim_well` si hace falta.

**Completaciones:** source **encontrado** — [Datos de fractura (Adjunto IV)](https://datos.energia.gob.ar/dataset/datos-de-fractura-de-pozos-adjunto-iv) resource `2280ad92-6ed3-403e-a095-50139863ab0d` (~4890 filas). Grano: una fila por `id_base_fractura_adjiv` con `cantidad_fracturas` (etapas). Join: `idpozo` / `sigla`. **No** está en el job default; load residual post-SA. No es no-goal: el source existe.

**Otras tablas SE (no Cap. IV, no en el job):** perforación mensual, distribución de petróleo, comercio exterior, ductos Res. 319/93. IDs y caveats (rigs ≠ pozos en perforación; distribución ≠ destinos de export; Brent no es SE): [`resources/sibling-sources.yml`](resources/sibling-sources.yml) + [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md) § Fuentes hermanas. Un tap nuevo = spec/ADR **antes** del `meltano.yml`.

---

## Handoff AE (aunque el load a BQ esté pendiente)

| | |
| --- | --- |
| Dataset | `raw_cap4` (prod) / `raw_cap4_dev` (dev) |
| Tabla de hecho | `produccion_pozo_mes` |
| Grano (2025 CONFIRMED) | `idpozo + anio + mes` único (0 dupes en 991 844 filas). `idpozo` ya es por formación productiva. |
| `periodo` | DATE `YYYY-MM-01` (columna del tap) |
| Recorte Pulse (raw amplio) | `formacion = 'vaca muerta'` (minúsculas) **y** `tipo_de_recurso = 'NO CONVENCIONAL'`. En 2025: 33 991 SHALE + 36 TIGHT + 24 NO CONV. sin subtipo. Filtro en `stg`/`int`, no en el tap. |
| Freshness | Cadencia mensual del Capítulo IV. Re-ingerir el CSV/Datastore del año cuando SE publica. SLA de producto: ≤ 7 días (spec). No hay Composer. |
| Unidades | `prod_pet` / `prod_agua` m³; `prod_gas` miles de m³; `tef` parece **días** (31.0 en enero en sample no-conv). Casts de negocio en dbt. |
| Schema dump | [catalogs/produccion_pozo_mes.fields.json](catalogs/produccion_pozo_mes.fields.json) |

---

## Smoke / año 2025 (estado)

Evidencia anual 2026-09-10 (SA materializada en runtime, **sin** secrets en git): [docs/hito-1-full-year-2025-load.md](docs/hito-1-full-year-2025-load.md). Smoke 500 previo (post-merge PR #5): [docs/hito-1-post-merge-smoke.md](docs/hito-1-post-merge-smoke.md). Costo (extrapolación + medido): [docs/hito-1-full-year-cost.md](docs/hito-1-full-year-cost.md).

| Check | Resultado |
| --- | --- |
| `COUNT(*)` `raw_cap4_dev.produccion_pozo_mes` | **991 844** (delta 0 vs Datastore) |
| Layout | MONTH(`_sdc_batched_at`) + CLUSTER `empresa,idpozo,cuenca` |
| Duración Meltano | **13 min 35 s** (~1 217 rec/s) |
| Bytes (committed + buffer) | **338.43 MiB** |
| Staging `__*` | ninguna |
| Prod `raw_cap4` | no se tocó |
| Smoke 500 (previo, #6) | exit 0; **504 s**; `COUNT(*)`=**500** |

Reemit en este proyecto (sandbox, DML off): `--recreate` (DROP+CREATE). Con billing: `--truncate` (dev) o `--delete-year` (prod).

```bash
cd extraction
source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-sa-key.sh)"  # gitignored
python scripts/prepare_year_load.py --dataset raw_cap4_dev --recreate
unset TAP_CKAN_DATASTORE_MAX_RECORDS
ALLOW_FULL_YEAR_LOAD=true MELTANO_ENVIRONMENT=dev meltano run cap4-produccion
python scripts/compare_source_count.py --dataset raw_cap4_dev
```

---

## Higiene

- `.meltano/`, `.venv/`, `.env`, JSON de SA, CSV crudos: gitignore
- Env vars: [.env.example](.env.example) (nombres; IDs CKAN son públicos)
- Plugins pinned: Meltano **4.2.2** en el Makefile; tap editable; target `z3z1ma/target-bigquery@090dad06` (no bump: el workaround de Bug 1 es append, no el DROP+CREATE de 0.7.2 ni el PR #139 sin mergear)
