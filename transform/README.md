# transform/ — dbt Core (Analytics Engineer)

**Hito 2.** Owner: **AE**. Producto UI: **Barrilito**. Repo: `vaca-muerta-pulse`.

dbt **Core** (gratis) + paquetes Hub. No dbt Cloud, no paquetes pagos. Meltano no se toca acá; el Front no lee `raw_*`.

Contrato de granos: [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md) § Grano 5. El identificador publicado es **`fct_barrilito_rate`** (el alias `mart_barrilito_headline` no se usa).

IAM / datasets (DE, PR #11): [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md). Secret de dbt: **`GCP_SA_KEY_DBT`** (nunca `GCP_SA_KEY` de Meltano).

---

## Source raw (Hito 2)

| | |
| --- | --- |
| **Primario (stg, target `dev`)** | `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes` |
| **`COUNT(*)`** | **991844** (año 2025 completo). Handoff DE/Tutor. Este PR de AE **no** re-consultó `INFORMATION_SCHEMA` ni inventó más evidencia de warehouse. |
| Twin prod | `raw_cap4.produccion_pozo_mes` — dataset **aún no existe**. `DBT_TARGET=prod` / `DBT_RAW_DATASET=raw_cap4` cuando DE lo cree. |
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

SA de dbt (nombre, **docs only**): **`vm-pulse-dbt`**. El JSON de la key **nunca** va al git. Copiá `profiles.yml.example` → `transform/profiles.yml` (gitignored) o `~/.dbt/profiles.yml` y apuntá `GOOGLE_APPLICATION_CREDENTIALS` a un path local gitignored.

| Capa | Dev (Hito 2, default) | Prod twin (futuro, `DBT_TARGET=prod`) |
| --- | --- | --- |
| Source (Meltano) | `raw_cap4_dev` | `raw_cap4` (aún no existe) |
| Staging | `stg_cap4_dev` | `stg_cap4` |
| Intermediate | `int_cap4_dev` | `int_cap4` |
| Marts (Front) | `marts_cap4_dev` | `marts_cap4` |

`generate_schema_name` escribe esos datasets (no `{profile}_stg`). Roles verificados (PR #11): `jobUser`; `dataViewer` en `raw_cap4_dev`; `dataEditor` en stg/int/marts. Detalle: [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md).

---

## Cómo correr (sin secretos en git)

```bash
cd transform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp profiles.yml.example profiles.yml   # gitignored — no lo commitees
# Materializá la key de vm-pulse-dbt (GCP_SA_KEY_DBT, no GCP_SA_KEY):
export BIGQUERY_PROJECT=vaca-muerta-pulse
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-dbt-sa-key.sh)"
dbt deps
dbt parse          # no necesita warehouse (verificado en este PR con dbt 1.12)
# dbt compile / build / test / show SÍ abren BigQuery con dbt-bigquery 1.12
```

Con credenciales (SA **`vm-pulse-dbt`**, secret **`GCP_SA_KEY_DBT`**, key fuera de git):

```bash
export BIGQUERY_PROJECT=vaca-muerta-pulse
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-dbt-sa-key.sh)"
dbt debug
# El mart headline es 1 fila. El build de fct_well_month lee stg → raw.
# raw_cap4_dev.produccion_pozo_mes COUNT(*) = 991844 (año 2025, handoff DE).
# Evitá select * de raw_*. Preferí --select acotado y dbt show --limit.
# Antes de un scan pesado: dry-run BQ. Raw ~338 MiB; si el estimado es ≫ 1 TiB, STOP.
dbt run --select stg+
dbt build --select fct_barrilito_rate+
dbt show --select fct_barrilito_rate --limit 5
```

`dbt build` **completo** no se corrió en el agente de este PR: **no hay `GCP_SA_KEY_DBT` inyectado** en este VM (IAM sí está OK en warehouse, ver PR #11). No se reutilizó `GCP_SA_KEY` de Meltano. No inventamos resultados verdes de warehouse.

Unit tests del mart (`test_type:unit`) también necesitan adapter BQ (tablas temporales). Están escritos; hay que correrlos con SA.

Targets: `dev` (default) → `raw_cap4_dev` / `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev`. `prod` → twins sin `_dev`.

### Cursor Cloud / GitHub (menú de secrets)

Mismo patrón que Meltano, **otro** secret:

1. Add secrets → **`GCP_SA_KEY_DBT`** = JSON **entero** de `{` a `}` de `vm-pulse-dbt`.
2. Opcional PEM: también **`GCP_SA_CLIENT_EMAIL_DBT`**.
3. `bash transform/scripts/materialize-dbt-sa-key.sh` escribe `transform/.secrets/vm-pulse-dbt.json` (gitignored).

No pegues `GCP_SA_KEY` (Meltano) acá.

---

## DAG

```text
source raw_cap4.produccion_pozo_mes   (físico: raw_cap4_dev; twin prod: raw_cap4)
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

- Staging es **view**; el primer `dbt build` de `fct_well_month` lee **991844** filas de `raw_cap4_dev.produccion_pozo_mes` (año 2025, ~338 MiB). No hagas `select *` de raw.
- Partición raw = `_sdc_batched_at` MONTH — **no** sirve para filtrar el mes Cap. IV (`periodo` vive en stg).
- Preferí dry-run BQ, `dbt show --limit`, `dbt run --select stg+`, luego `dbt build --select fct_barrilito_rate+`.
- Recorte VM en stg (~34k well-months en el sample DataStore 2025); el scan de raw sigue siendo el año entero si la view no predica partición.
- Si un dry-run estima ≫ 1 TiB, **STOP**.

---

## Referencias

- [spec.md](../specs/001-vaca-muerta-pulse/spec.md)
- [plan.md](../specs/001-vaca-muerta-pulse/plan.md) Hito 2
- [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md)
- [extraction/README.md](../extraction/README.md) (raw, no transformar acá)
