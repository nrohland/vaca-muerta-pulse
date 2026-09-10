# Tasks — Hito 1 (raw BigQuery + Meltano)

Solo **Hito 1**. Hitos 2–3 no se tachan acá. Criterios de aceptación: [plan.md](plan.md). Owner: **DE**. Folder: [`extraction/`](../../extraction/README.md).

Tachá en el PR que complete el ítem. Smoke BQ post-fix de overwrite/throughput: **falta evidencia en este PR** (la VM del agente no tiene `GCP_SA_KEY`). Handoff humano: dataset `raw_cap4_dev` existe; 500 filas en staging; final 0 filas por Bug 1.

## GCP y BigQuery

- [x] Proyecto GCP del Pulse documentado (id del proyecto, región, **sin** keys).
- [x] APIs: BigQuery (+ IAM lo mínimo). Billing/alerta de presupuesto mencionadas en `extraction/README.md`.
- [x] Dataset raw creado (nombre propuesto `raw_cap4`; si cambia, update [architecture.md](../../docs/architecture.md)). — **handoff: `raw_cap4_dev` existe**; prod `raw_cap4` mismo patrón
- [x] Service account de Meltano: rol mínimo de **escritura** a `raw_*`; JSON **fuera** del repo (`GOOGLE_APPLICATION_CREDENTIALS` o Secret Manager). — documentado; JSON no commiteado; handoff: SA `vm-pulse-meltano` autentica
- [x] `.env.example` (opcional) con **nombres** de variables, cero secretos.

## Diseño físico de la tabla de producción

- [x] Decisión documentada: partition column (`DATE` de período vs otra).
- [x] Decisión documentada: `CLUSTER BY` (orden de columnas).
- [x] Convención de nombres de tabla raw (1:1 con el stream del tap).
- [x] Estrategia si el CSV anual se **reemite** (truncate partition vs append + `rectificado`): escrita en `extraction/README.md` o data-model.

## Meltano

- [x] Proyecto Meltano inicializado **en** `extraction/` (no en la raíz salvo ADR).
- [x] `meltano.yml` versionado; plugins pinned de forma reproducible.
- [x] Tap elegido y justificado en README (CKAN Datastore vs CSV anual vs tap-rest). **Sin** scraper del HTML de consulta avanzada.
- [x] `target-bigquery` (o equivalente Singer a BQ) configurado con partition/cluster.
- [x] Environments `dev` / `prod` o equivalente; credenciales por env, no hardcode.
- [x] Comando documentado: un `meltano run` (o `make extract`) que un contributor puede copiar.
- [x] Resource IDs / URLs del Capítulo IV listados (producción por año mínimo).

## Loads de smoke

- [ ] Load de **al menos un año** de producción pozo-mes a BQ. — **pendiente post-fix.** Handoff: 500 filas en staging `produccion_pozo_mes__*`; final 0 filas (Bug 1). Este PR: `overwrite:false` + Storage Write API. Repro en `extraction/README.md`.
- [ ] Verificación: tabla **particionada** y **clustered** (screenshot o query a `INFORMATION_SCHEMA` en el PR, sin datos sensibles). — **handoff (tabla existente, 0 filas):** MONTH(`_sdc_batched_at`) + CLUSTER `empresa`,`idpozo`,`cuenca`. Falta evidencia **después** del append que deje COUNT>0. Queries: `extraction/sql/verify_layout.sql`.
- [ ] Conteo de filas vs source (delta explicado: header, duplicados, filtro). — Datastore 2025 `total=991844` documentado; falta `COUNT(*)` BQ en la tabla **final**
- [x] Sample de columnas reales vs lista draft: PR actualiza [data-model.md](data-model.md) (CONFIRMED / UNKNOWN). — evidencia DataStore, no INFORMATION_SCHEMA

## Padrón y completaciones (descubrimiento, no dbt)

- [x] ¿El CSV de producción ya trae dims de pozo suficientes? Documentar sí/no.
- [x] Si hace falta padrón/pozos aparte: tap extra **o** tarea explícita “no en Hito 1” con motivo.
- [x] Completaciones/fracturas: encontrar resource **o** escribir en data-model + spec que v1 no tiene source (empty state Hito 3).
- [x] Si hay source de completaciones: load raw smoke **o** issue/task residual linkeada; no silenciar. — stream en el tap, deseleccionado; load residual (mismo job pattern, no en default)

## Higiene y DoD Hito 1

- [x] `extraction/README.md` reescrito para un humano que clona el repo (prereqs Python, Meltano, GCP).
- [x] `.gitignore` cubre `.meltano/`, outputs, keys (ajustar si el init crea paths nuevos).
- [x] Ningún CSV pesado commiteado.
- [x] Ningún JSON de SA, ningún `.env` real.
- [ ] [plan.md](plan.md) Hito 1: casillas de aceptación revisadas (se tildan cuando QA/DE cierran el hito). — scaffold + fix overwrite/throughput en repo; smoke BQ COUNT>0 aún no verificado en este PR
- [x] No hay `dbt_project.yml` ni app Next en este hito (rechazar scope creep).

## Fuera de este checklist

- Modelos `stg`/`int`/`marts`, tests dbt, Tremor, hosting del front.
- Convertir m³ → bbl en el tap.
- Airflow/Composer.
