# ADR 0001 — Stack: Meltano, BigQuery (PARTITION + CLUSTER), dbt, Next.js + Tremor

- **Estado:** Aceptado (Hito 0)
- **Fecha:** 2026-09-10
- **Owners:** DE (ingesta/BQ), AE (dbt), Front (UI)

## Contexto

Vaca Muerta Pulse es un data product público de portfolio: hay que mostrar **criterio de ingeniería** (ingesta reproducible, warehouse barato, modelo testeable, UI de storytelling) sin pagar Snowflake ni un equipo de plataforma.

Fuente: Capítulo IV (Secretaría de Energía), CSVs / CKAN, cadencia mensual, volumen de años de pozo-mes — cabe en BigQuery free/cheap-tier **si** no hacemos full scans.

## Decisión

| Capa | Elegimos | No elegimos (v1) |
| --- | --- | --- |
| Ingesta | **Meltano** (Singer taps + `target-bigquery`) | Airbyte Cloud, scripts one-off sin job versionado, Composer |
| Warehouse | **BigQuery** con **PARTITION** + **CLUSTER** en hechos | Snowflake, Redshift, DuckDB como sistema de record |
| Transform | **dbt Core**, capas `stg` → `int` → `marts` | SQL suelto en notebooks, Dataform, dbt Cloud pago |
| UI | **Next.js + Tremor** | Streamlit, Metabase público, Observable como producto final |

Detalle de *por qué* abajo. El dibujo del flujo: [architecture.md](../architecture.md).

## Por qué Meltano

- Un `meltano.yml` es el contrato de ingesta: plugins, env, schedules — revisable en PR, amigable a agentes.
- Ecosistema Singer: tap de REST/CKAN o tap-csv para los anuales; `target-bigquery` cubre el load.
- Corre en laptop/CI; no hay que mantener un Airbyte 24/7.
- Separación nítida con dbt (EL vs T), alineada a roles DE vs AE.

**Trade-off:** puede hacer falta un tap custom o `tap-rest` contra Datastore/CKAN si el CSV anual es tosco. Eso es trabajo de Hito 1, no un cambio de ADR. Scripts Python sueltos quedan como *último* recurso documentado en `extraction/README.md`.

## Por qué BigQuery + PARTITION + CLUSTER

- El producto ya asume GCP barato; BQ on-demand encaja con dashboard de lectura esporádica.
- Capítulo IV es **append/restate mensual por año**: partition por mes (o fecha de período) limita bytes al “último N meses”.
- CLUSTER en dimensiones de filtro (`empresa`, pozo, `cuenca`) reduce shuffle en las queries del front.
- Sin PARTITION, un `SELECT *` de histórico de pozos se come el free tier en un demo.

**Trade-off:** semántica de partición hay que acertarla en Hito 1 (tipo `DATE`, no partition por `STRING` de mes). Clustering no reemplaza predicados de partition. DuckDB vale para exploración local; no es el warehouse del dashboard público.

## Por qué dbt Core (`stg` → `int` → `marts`)

- Granos del spec (pozo-mes, empresa, área, completaciones) se vuelven modelos con tests (`unique`, `not_null`, accepted values para `tipo_de_recurso`).
- `stg` = fiel al raw (rename/types/filtro VM); `int` = claves y unidades; `marts` = lo que Tremor puede contar.
- dbt Core es gratis y vive en `transform/`; Cloud/Mesh no aportan en un repo solo.

**Trade-off:** el primer `dbt run` sobre raw mal tipado duele — por eso Hito 1 cierra columnas reales antes del Hito 2. No “marts en el tap”.

## Por qué Next.js + Tremor

- Storytelling ≠ notebook: rutas, layout, performance, deploy estático o casi.
- Tremor cubre KPI + series temporales con poco CSS custom, suficiente para producción/completaciones.
- Next permite (Hito 3) leer marts en server components sin exponer SA al browser.

**Trade-off:** más setup que Streamlit. Streamlit acelera un spike interno; no es el artefacto de portfolio ni un front público durable. Un cambio a otro kit de charts no exige cambiar Next si el ADR de UI se abre aparte.

## Consecuencias

- Folders fijos: `extraction/` (Meltano), `transform/` (dbt), `apps/web/` (Next). Ver [AGENTS.md](../../AGENTS.md).
- Hito 1 no incluye modelos dbt ni app.
- Cualquier reemplazo de una fila de la tabla de decisión → ADR nuevo (`0002-…`) y update de architecture + README.
- Hosting concreto del front (Vercel vs Cloud Run vs Firebase) **queda abierto**; no bloquea Hito 0–2.

## Alternativas consideradas (resumen)

| Alternativa | Por qué no v1 |
| --- | --- |
| Solo CSVs + Observable | No muestra warehouse ni DE/AE |
| Airflow/Composer | Costo y ops para un job mensual |
| Postgres + Metabase | Menos “data stack” de industria; GIS/BQ partitions son el punto |
| dbt + DuckDB motherduck | Válido para demo local; mix GCP del brief pide BQ |
