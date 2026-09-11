# transform/ — dbt Core (Analytics Engineer)

**Hito 2.** Owner: **AE** (modelos). **DE** provisionó IAM + datasets. Producto UI: **Barrilito**. Repo: `vaca-muerta-pulse`.

dbt **Core** (gratis) + paquetes Hub. No dbt Cloud, no paquetes pagos. Meltano no se toca acá; el Front no lee `raw_*`.

Contrato de granos: [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md) § Grano 5. El identificador publicado es **`fct_barrilito_rate`** (el alias `mart_barrilito_headline` no se usa).

IAM + datasets (evidencia DE): [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md).

---

## Source raw (Hito 2)

| | |
| --- | --- |
| **Primario (stg, target `dev`)** | `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes` |
| **`COUNT(*)`** | **991844** (año 2025 completo). Handoff DE/Tutor + [evidencia Hito 1](../extraction/docs/hito-1-full-year-2025-load.md). Este PR de AE **no** re-consultó `INFORMATION_SCHEMA` ni inventó más evidencia de warehouse. |
| Twin prod | `raw_cap4.produccion_pozo_mes` (mismo grano / mismo nombre de tabla). **El dataset `raw_cap4` no existe todavía.** `DBT_TARGET=prod` o `DBT_DATASET_RAW=raw_cap4` cuando DE lo cree. |
| Match source | Datastore 2025 resource `d774b5d7-0756-48fe-88f2-8729b57b22da` total 991 844 |

`var('raw_dataset')` default = `raw_cap4_dev`. No apuntes stg a un dump local.

---

## Contrato para Frontend (Hito 3)

Leé **solo** marts. Headline = este mart, una fila.

| | |
| --- | --- |
| Mart | `fct_barrilito_rate` |
| Dataset BQ (dev) | **`marts_cap4_dev`** |
| Dataset BQ (prod, futuro) | `marts_cap4` |
| Proyecto | `vaca-muerta-pulse` |
| Grano | **Una fila** = total Vaca Muerta **no convencional** del **último mes Capítulo IV** |
| Qué no es | Telemetría, SCADA, grano horario, ranking por empresa |

**Columnas clave**

| Columna | Uso |
| --- | --- |
| `rate_bbl_dia` | Insumo del contador interpolado (bbl/día). Alias `rate_bbl_per_day` = el mismo valor |
| `rate_m3_dia` | Misma tasa en m³/día (tooltip). Alias `rate_m3_per_day` |
| `rate_method` | `tef_weighted` (preferida) o `calendar_days` (fallback) |
| `periodo`, `anio`, `mes` | Mes oficial Cap. IV (`periodo` = DATE `YYYY-MM-01`) |
| `prod_pet_m3`, `tef_sum`, `days_in_month` | Numerador / denominadores |
| `source_batched_at_max`, `fecha_data_max` | Frescura del load (no son el mes de producción) |
| `is_simulation`, `disclaimer` | Siempre simulación. Copy MUST junto al contador |

**Métrica:** `bbl = m³ × 6.28981077`. El mismo número vive en `var('m3_to_bbl')`, el macro `m3_to_bbl()`, [metrics.yml](metrics.yml) y `config.meta` de `fct_barrilito_rate`. **No** recalcules el factor en el browser.

**Disclaimer MUST (visible, no solo footer):** *simulación a partir de datos mensuales oficiales*.

**Frescura:** Capítulo IV es **mensual**. `periodo` es el último mes de DDJJ en el mart de pozo-mes. `_sdc_batched_at` es cuándo Meltano bateó — no lo uses como mes de producción.

Well-month (series / rankings posteriores, no el headline): `fct_well_month`, grano `idpozo+anio+mes`, recorte VM ya aplicado. Empresa / área / completaciones = **P1** (no en este PR).

### Query de sample

```sql
select
  periodo,
  anio,
  mes,
  rate_bbl_dia,
  rate_m3_dia,
  rate_method,
  source_batched_at_max,
  fecha_data_max,
  disclaimer
from `vaca-muerta-pulse.marts_cap4_dev.fct_barrilito_rate`;
```

Análisis compilable: [analyses/sample_barrilito_headline.sql](analyses/sample_barrilito_headline.sql).

---

## Datasets dbt (ops)

SA de dbt (nombre, **docs only**): **`vm-pulse-dbt`**. El JSON de la key **nunca** va al git. Copiá `profiles.yml.example` → `transform/profiles.yml` (gitignored) o `~/.dbt/profiles.yml` y apuntá `GOOGLE_APPLICATION_CREDENTIALS` a un path local.

| Capa | Dev (Hito 2, default) | Prod twin (futuro, `DBT_TARGET=prod`) |
| --- | --- | --- |
| Source (Meltano) | `raw_cap4_dev` | `raw_cap4` (aún no existe) |
| Staging | `stg_cap4_dev` | `stg_cap4` |
| Intermediate | `int_cap4_dev` | `int_cap4` |
| Marts (Front) | `marts_cap4_dev` | `marts_cap4` |

`generate_schema_name` escribe esos datasets (no `{profile}_stg`). IAM **verificado** 2026-09-10: [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md).

---

## Warehouse IAM (confirmado 2026-09-10)

**Sí hay que usar la SA `vm-pulse-dbt` (creada por Nico; bindings OK).** No reutilices la SA ni la key de Meltano (`vm-pulse-meltano` / `GCP_SA_KEY`).

| Por qué | Detalle |
| --- | --- |
| Least privilege | Meltano **escribe** `raw_*`. dbt **lee** raw y **escribe** `stg` / `int` / `marts`. Misma key = dbt con write a raw. |
| Secretos | GitHub / Cursor: `GCP_SA_KEY_DBT` **aparte** de `GCP_SA_KEY`. |
| Grants | BigQuery no deja colgar `dataViewer` / `dataEditor` a un email que no existe. |

Proyecto: `$BIGQUERY_PROJECT` / `$DBT_BIGQUERY_PROJECT`. Location: **US**.

| Dataset | Estado | Quién escribe |
| --- | --- | --- |
| `raw_cap4_dev` | existe (Hito 1; `COUNT(*)` = 991844) | Meltano |
| `raw_cap4` | **no existe** todavía | Meltano (prod, cuando se cree) |
| `stg_cap4_dev` | **creado** US | dbt |
| `int_cap4_dev` | **creado** US | dbt |
| `marts_cap4_dev` | **creado** US | dbt |

Roles de `vm-pulse-dbt@$BIGQUERY_PROJECT.iam.gserviceaccount.com` (**verificados** 2026-09-10):

- Proyecto: `roles/bigquery.jobUser` (job de `INFORMATION_SCHEMA.SCHEMATA` OK)
- `raw_cap4_dev`: `roles/bigquery.dataViewer` (READER; `list_tables` sin scan)
- `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev`: `roles/bigquery.dataEditor` (WRITER; create+drop tabla 0 filas)
- `raw_cap4`: no existe todavía

La SA de Meltano quedó **OWNER** de los datasets dbt porque los creó. No escribe modelos ahí.

### Scripts IAM (sin secretos)

| Script | Para qué |
| --- | --- |
| [scripts/provision_hito2_bq.sh](scripts/provision_hito2_bq.sh) | `--verify-only` lista datasets + SA; Nico: grants / `--unset-table-expiration` / `--tighten-acl` |
| [scripts/provision_hito2_bq.py](scripts/provision_hito2_bq.py) | implementación (bq + REST IAM) |
| [scripts/materialize-dbt-sa-key.sh](scripts/materialize-dbt-sa-key.sh) | runtime: `GCP_SA_KEY_DBT` → `.secrets/vm-pulse-dbt.json` |

El script de dbt **rechaza** `GCP_SA_KEY` de Meltano a propósito. SA `vm-pulse-dbt` **creada por Nico**; bindings OK.

```bash
export GCP_SA_KEY_DBT='<JSON completo de vm-pulse-dbt>'
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-dbt-sa-key.sh)"
bash scripts/provision_hito2_bq.sh --verify-only
```

---

## Env (nombres, cero keys)

Copiá [`.env.example`](.env.example) a `transform/.env` (gitignored) o exportá las vars. **Solo nombres** en git.

| Variable | Para qué |
| --- | --- |
| `DBT_BIGQUERY_PROJECT` | Proyecto BQ. Alias de `BIGQUERY_PROJECT` (el que lee `profiles.yml.example`). |
| `BIGQUERY_LOCATION` | `US` |
| `DBT_DATASET_RAW` | Source Hito 2: `raw_cap4_dev` |
| `DBT_DATASET_STG` | `stg_cap4_dev` |
| `DBT_DATASET_INT` | `int_cap4_dev` |
| `DBT_DATASET_MARTS` | `marts_cap4_dev` |
| `DBT_TARGET` | `dev` (default) o `prod` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path a un JSON **gitignored** (p.ej. `./.secrets/vm-pulse-dbt.json`) |
| `GCP_SA_KEY_DBT` | Secret de CI / Cloud: JSON **completo** de la key de `vm-pulse-dbt`. **No** es `GCP_SA_KEY` (Meltano). |

Local, si ya tenés la key (Nico la creó; preferible ADC / WIF):

```bash
cd transform
mkdir -p .secrets                          # .secrets/ está gitignored
# el JSON vive acá o en GH Secrets — nunca en el commit
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/.secrets/vm-pulse-dbt.json"
# o, si el secret está en el entorno (NO copies a GCP_SA_KEY):
export GCP_SA_KEY_DBT='<JSON completo de vm-pulse-dbt>'
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-dbt-sa-key.sh)"
```

### Cursor Cloud / GitHub (el menú de secrets)

Mismo patrón que Meltano, **otro** secret:

1. En el run del agente aparece el menú **Add secrets**.
2. Pegá el JSON **entero** de la key (de `{` a `}`) en **`GCP_SA_KEY_DBT`**.
3. Si solo tenés el PEM, pegá también **`GCP_SA_DBT_CLIENT_EMAIL`** = `vm-pulse-dbt@<project-id>.iam.gserviceaccount.com` (o `BIGQUERY_PROJECT`).
4. El script materializa a `transform/.secrets/vm-pulse-dbt.json` (gitignored) y **rechaza** `GCP_SA_KEY` de Meltano.

Este PR **no** descarga ni commitea un JSON de SA.

---

## Cómo correr (sin secretos en git)

```bash
cd transform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp profiles.yml.example profiles.yml   # gitignored — no lo commitees
# GOOGLE_APPLICATION_CREDENTIALS → JSON local de vm-pulse-dbt (fuera de git)
dbt deps
dbt parse          # no necesita warehouse (verificado en este PR con dbt 1.12)
# dbt compile / build / test / show SÍ abren BigQuery con dbt-bigquery 1.12
```

Con credenciales (SA **`vm-pulse-dbt`**, key fuera de git):

```bash
export BIGQUERY_PROJECT=vaca-muerta-pulse
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/vm-pulse-dbt.json
dbt debug
# El mart headline es 1 fila. El build de fct_well_month lee stg → raw.
# raw_cap4_dev.produccion_pozo_mes COUNT(*) = 991844 (año 2025, handoff DE).
# Evitá select * de raw_*. Preferí --select fct_barrilito_rate+ y dbt show --limit.
dbt build --select fct_barrilito_rate+
dbt show --select fct_barrilito_rate --limit 5
```

`dbt build` **completo** no se corrió en el agente de este PR: no hay credenciales BQ en el entorno. No inventamos resultados verdes de warehouse.

Unit tests del mart (`test_type:unit`) también necesitan adapter BQ (tablas temporales). Están escritos; hay que correrlos con SA.

Targets: `dev` (default) → `raw_cap4_dev` / `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev`. `prod` → twins sin `_dev`.

---

## DAG

```text
source raw_cap4.produccion_pozo_mes   (físico: raw_cap4_dev; twin prod: raw_cap4 — aún no existe)
  → stg_produccion_pozo_mes     (view en stg_cap4_dev: cast, periodo, filtro VM, dedupe)
  → int_produccion_vm_noconv    (view en int_cap4_dev: surrogate + days_in_month)
  → fct_well_month              (tabla en marts_cap4_dev, partition periodo)
  → fct_barrilito_rate          (1 fila en marts_cap4_dev)
```

Filtro de producto en **stg** (strings CONFIRMED): `formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'`.

Tasa: `sum(prod_pet_m3) / nullif(sum(tef), 0)` si `tef_sum > 0`; si no, `/ days_in_month`. Calidad de `tef` como días en el recorte VM = **UNKNOWN** hasta un `dbt test` con warehouse.

---

## Paquetes Hub (gratis)

| Pedido | En `packages.yml` | Uso acá |
| --- | --- | --- |
| dbt-utils | `dbt-labs/dbt_utils` | surrogate key, unique combo, expression tests |
| dbt-expectations | `metaplane/dbt_expectations` | row count = 1, rango de `tef` (warn) |
| dbt-codegen | `dbt-labs/codegen` | `dbt run-operation generate_source` si el schema raw cambia |
| dbt-date | `godatadriven/dbt_date` (Hub actual; `calogica/dbt_date` redirige y duplicaba el proyecto) | dispatch; BQ usa `LAST_DAY` para no armar un date spine |
| dbt-event-logging | `dbt-labs/logging` (sucesor Hub; el paquete 0.1.x de 2018 no parsea) | hooks **apagados** (crean tablas en BQ) |
| dbt-doctor | **no está en Hub** (CLI npm). No mezclamos npm | `dbt-labs/dbt_project_evaluator` instalado y **disabled** |

Codegen (cuando haya SA y quieras refrescar YAML de source):

```bash
dbt run-operation generate_source --args '{"schema_name": "raw_cap4_dev", "database_name": "vaca-muerta-pulse"}'
```

Evaluator (caro; no es el `dbt build` default). Los modelos del paquete están `+enabled: false`. Para un check puntual, habilitá `models.dbt_project_evaluator.+enabled` en `dbt_project.yml` o no lo corras en el camino de Hito 2.

---

## Costo BigQuery

- Staging es **view**; el primer `dbt build` de `fct_well_month` lee **991844** filas de `raw_cap4_dev.produccion_pozo_mes` (año 2025). No hagas `select *` de raw.
- Partición raw = `_sdc_batched_at` MONTH — **no** sirve para filtrar el mes Cap. IV (`periodo` vive en stg).
- Preferí `dbt show --limit`, `dbt build --select fct_barrilito_rate+`.
- Recorte VM en stg (~34k well-months en el sample DataStore 2025); el scan de raw sigue siendo el año entero si la view no predica partición.

---

## Referencias

- [spec.md](../specs/001-vaca-muerta-pulse/spec.md)
- [plan.md](../specs/001-vaca-muerta-pulse/plan.md) Hito 2
- [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md)
- [extraction/README.md](../extraction/README.md) (raw, no transformar acá)
- [extraction/docs/hito-1-full-year-2025-load.md](../extraction/docs/hito-1-full-year-2025-load.md)
