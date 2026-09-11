# Tasks — Hito 1 + notas Hito 2/3

Criterios de aceptación: [plan.md](plan.md). Marca UI: **Barrilito** (repo `vaca-muerta-pulse`).

- **Hito 1** (abajo): owner **DE**, folder [`extraction/`](../../extraction/README.md). Cadencia extract **mensual**; no cambiar `meltano.yml` en un PR de marca/producto.
- **Hito 2 / 3:** Hito 2 código en `transform/` (modelos Barrilito + IAM/datasets). Hito 3 Next **sin tachar**.

Tachá en el PR que complete el ítem. Año 2025 cargado 2026-09-10: `COUNT(*)` **991 844** (delta 0 vs Datastore). Evidencia: [extraction/docs/hito-1-full-year-2025-load.md](../../extraction/docs/hito-1-full-year-2025-load.md). Smoke 500 previo: [extraction/docs/hito-1-post-merge-smoke.md](../../extraction/docs/hito-1-post-merge-smoke.md).

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

- [x] Load de **al menos un año** de producción pozo-mes a BQ. — 2025 completo en `raw_cap4_dev.produccion_pozo_mes`: `COUNT(*)` = **991 844**. Wall-clock 13 min 35 s. [evidencia](../../extraction/docs/hito-1-full-year-2025-load.md).
- [x] Verificación: tabla **particionada** y **clustered**. — DDL + `tables.get`: MONTH(`_sdc_batched_at`) + CLUSTER `empresa`,`idpozo`,`cuenca`. Write API deja filas en streaming buffer / `__UNPARTITIONED__` al cierre.
- [x] Conteo de filas vs source (delta explicado: header, duplicados, filtro). — Datastore 2025 `total=991844`; BQ final **991844**; delta **0**; grano `idpozo+anio+mes` único.
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
- [x] [plan.md](plan.md) Hito 1: casillas de aceptación revisadas (se tildan cuando QA/DE cierran el hito). — año 2025 en `raw_cap4_dev` con COUNT=source; QA sigue siendo quien cierra el hito. Completaciones raw siguen residuales.
- [x] No hay `dbt_project.yml` ni app Next en este hito (rechazar scope creep).

## Fuera del checklist Hito 1

- Modelos `stg`/`int`/`marts`, tests dbt, Tremor, hosting del front.
- Convertir m³ → bbl en el tap (la conversión vive en Hito 2 + YAML).
- Schedule Meltano sub-diario / sensores.
- Airflow/Composer.

---

## Hito 2 — IAM + datasets BQ (DE, prereq de dbt)

Evidencia: [transform/docs/hito-2-bq-iam.md](../../transform/docs/hito-2-bq-iam.md). Scripts: [provision_hito2_bq.sh](../../transform/scripts/provision_hito2_bq.sh), [materialize-dbt-sa-key.sh](../../transform/scripts/materialize-dbt-sa-key.sh). SA + bindings: Nico (PR #11). Modelos Barrilito: PR #10.

- [x] Datasets US: `stg_cap4_dev`, `int_cap4_dev`, `marts_cap4_dev`.
- [x] `raw_cap4_dev` existe; `raw_cap4` no.
- [x] SA `vm-pulse-dbt` **creada por Nico** + auth `GCP_SA_KEY_DBT` (distinto de Meltano `GCP_SA_KEY`; el agente de modelos de este PR no tiene el secret inyectado).
- [x] Roles: `jobUser`; `dataViewer` (READER) en `raw_cap4_dev`; `dataEditor` (WRITER) en stg/int/marts.
- [x] Docs + `.env.example` con nombres (`DBT_BIGQUERY_PROJECT`, `DBT_DATASET_*`, `GCP_SA_KEY_DBT`).
- [x] Default table expiration 60d en datasets dbt — documentado; Nico puede `--unset-table-expiration`.

## Hito 2 — tasa Barrilito (AE, `transform/`)

Owner: **AE**. Contrato: [data-model.md](data-model.md) § Grano 5. Código: [`transform/`](../../transform/README.md).

- [x] Mart `fct_barrilito_rate` (identificador único; alias `mart_barrilito_headline` retirado).
- [x] Grano: **una fila** = snapshot del recorte VM no conv. para el **último mes Capítulo IV** (agregado **total** Pulse, no por empresa).
- [x] Fórmula preferida: `rate_m3_dia = sum(prod_pet_m3) / nullif(sum(tef), 0)` cuando `tef_sum > 0` (`tef_weighted`).
- [x] Fallback: `rate_m3_dia = sum(prod_pet_m3) / days_in_month(periodo)` (`calendar_days`). Unit tests con fixtures para `tef` = 0. Viabilidad de `tef` **en warehouse** = UNKNOWN (este PR no tuvo SA BQ; no se afirma `dbt test` verde contra raw).
- [x] Conversión `rate_bbl_dia = rate_m3_dia × 6.28981077` en el modelo (`var('m3_to_bbl')` / macro).
- [x] El **mismo** factor `6.28981077` en YAML de métricas (`transform/metrics.yml` + `config.meta`) y `dbt_project.yml`.
- [x] `stg` materializa `periodo` como grano de negocio; no filtrar el mes Cap. IV por `_sdc_batched_at`.
- [x] Source primario: `raw_cap4_dev.produccion_pozo_mes`. **`COUNT(*)` = 991844** (año 2025) — handoff DE/Tutor. Twin prod: `raw_cap4`. Este PR no re-consultó `INFORMATION_SCHEMA`.
- [x] Test de reconciliación SQL: `prod_pet_m3` Barrilito vs suma de `fct_well_month` del mismo `periodo` (corre con `dbt test` cuando hay warehouse).
- [x] Actualizar [data-model.md](data-model.md): contrato `fct_barrilito_rate`; tef no promovido a CONFIRMED. Sin sensores ni grano intradía.
- [ ] `dbt build` / `dbt test` contra BigQuery — **bloqueado** 2026-09-10: IAM de `vm-pulse-dbt` OK (PR #11); este agente **no** tiene `GCP_SA_KEY_DBT` inyectado (env vacío, sin ADC, `gh secret list` 403). No se usó `GCP_SA_KEY` Meltano. Instrucciones: [transform/README.md](../../transform/README.md). `dbt deps` + `dbt parse` sí.

---

## Hito 3 — contador + disclaimer (Front, `apps/web/`) — nota only

No implementar Next/Tremor acá ni en Hito 2. Owner: **Front**. Spec: R6 / R6b.

- [ ] Headline = contador de barriles interpolado desde `rate_bbl_dia` del mart (aspecto “extrayéndose” en vivo).
- [ ] Disclaimer **MUST** visible junto al contador: *simulación a partir de datos mensuales oficiales*.
- [ ] Copy: no afirmar telemetría, SCADA, ni que Capítulo IV sea tiempo real / alta frecuencia.
- [ ] Petróleo de headline en **bbl**; m³ disponible en otras vistas si el mart lo expone.
- [ ] README de `apps/web/` documenta mart de tasa + disclaimer (sin secretos en el cliente).
