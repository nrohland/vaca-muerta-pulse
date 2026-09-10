# transform/ — dbt Core (Analytics Engineer)

**Hito 2.** Owner: **AE**. Producto UI: **Barrilito**. Repo: `vaca-muerta-pulse`.

dbt **Core** (gratis) + paquetes Hub. No dbt Cloud, no paquetes pagos. Meltano no se toca acá; el Front no lee `raw_*`.

Contrato de granos: [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md) § Grano 5. El identificador publicado es **`fct_barrilito_rate`** (el alias `mart_barrilito_headline` no se usa).

---

## Source raw (Hito 2)

| | |
| --- | --- |
| **Primario (stg, target `dev`)** | `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes` |
| **`COUNT(*)`** | **991844** (año 2025 completo). Handoff DE/Tutor. Este PR de AE **no** re-consultó `INFORMATION_SCHEMA` ni inventó más evidencia de warehouse. |
| Twin prod | `raw_cap4.produccion_pozo_mes` (mismo grano / mismo nombre de tabla). `DBT_TARGET=prod` o `DBT_RAW_DATASET=raw_cap4`. |
| Match source | Datastore 2025 resource `d774b5d7-0756-48fe-88f2-8729b57b22da` total 991 844 |

`var('raw_dataset')` default = `raw_cap4_dev`. No apuntes stg a un dump local.

---

## Contrato para Frontend (Hito 3)

Leé **solo** marts. Headline = este mart, una fila.

| | |
| --- | --- |
| Mart | `fct_barrilito_rate` |
| Dataset BQ | `marts_dev` (target `dev`) / `marts` (target `prod`) |
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
from `vaca-muerta-pulse.marts_dev.fct_barrilito_rate`;
```

Análisis compilable: [analyses/sample_barrilito_headline.sql](analyses/sample_barrilito_headline.sql).

---

## Cómo correr (sin secretos en git)

```bash
cd transform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp profiles.yml.example ~/.dbt/profiles.yml   # o DBT_PROFILES_DIR
# Editá GOOGLE_APPLICATION_CREDENTIALS hacia un JSON de SA *fuera* del repo.
dbt deps
dbt parse          # no necesita warehouse (verificado en este PR con dbt 1.12)
# dbt compile / build / test / show SÍ abren BigQuery con dbt-bigquery 1.12
# (el adapter autentica al compilar). Sin SA no se afirma compile verde.
```

Con credenciales de BigQuery (SA de **lectura** `raw_*` + **escritura** a `stg_cap4_*` / `int_*` / `marts_*`, no la key en git):

```bash
export BIGQUERY_PROJECT=vaca-muerta-pulse
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/sa.json
dbt debug
# El mart headline es 1 fila. El build de fct_well_month lee stg (view) → raw.
# raw_cap4_dev.produccion_pozo_mes COUNT(*) = 991844 (año 2025, handoff DE).
# Evitá select * de raw_*. Preferí --select fct_barrilito_rate+ y dbt show --limit.
dbt build --select fct_barrilito_rate+
dbt show --select fct_barrilito_rate --limit 5
```

`dbt build` **completo** no se corrió en el agente de este PR: no hay credenciales BQ en el entorno. No inventamos resultados verdes de warehouse.

Unit tests del mart (`test_type:unit`) también necesitan adapter BQ (tablas temporales). Están escritos; hay que correrlos con SA.

Targets: `dev` (default) → source **`raw_cap4_dev`** / `stg_cap4_dev` / `marts_dev`. `prod` → twin **`raw_cap4`** / `stg_cap4` / `marts`.

---

## DAG

```text
source raw_cap4.produccion_pozo_mes   (físico: raw_cap4_dev; twin prod: raw_cap4)
  → stg_produccion_pozo_mes     (cast, periodo, filtro VM, dedupe)
  → int_produccion_vm_noconv    (ephemeral: surrogate + days_in_month)
  → fct_well_month              (tabla, partition periodo)
  → fct_barrilito_rate          (1 fila, último periodo)
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
- [extraction/README.md](../extraction/README.md) (raw, no transformar acá)
