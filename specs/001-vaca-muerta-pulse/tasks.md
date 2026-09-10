# Tasks — Hito 1 + notas Hito 2/3

Criterios de aceptación: [plan.md](plan.md). Marca UI: **Barrilito** (repo `vaca-muerta-pulse`).

- **Hito 1** (abajo): owner **DE**, folder [`extraction/`](../../extraction/README.md). Cadencia extract **mensual**; no cambiar `meltano.yml` en un PR de marca/producto.
- **Hito 2 / 3:** secciones al final, **sin tachar**. No implementar dbt ni Next en este PR de specs.

Tachá Hito 1 en el PR que complete el ítem. Smoke 500 post-fix 2026-09-10: `COUNT(*)` final **500** (streaming buffer). Layout MONTH(`_sdc_batched_at`)+CLUSTER en [extraction/docs/hito-1-post-merge-smoke.md](../../extraction/docs/hito-1-post-merge-smoke.md). Año completo (~991k) **bloqueado** hasta OK de costo de Nicolás — este PR no corre Meltano full-year.

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

- [ ] Load de **al menos un año** de producción pozo-mes a BQ. — **bloqueado (costo).** Smoke 500 post-fix OK en tabla final (Write API). Año 2025 (~991 844) no se carga hasta OK de Nicolás. Bytes: [extraction/docs/hito-1-full-year-cost.md](../../extraction/docs/hito-1-full-year-cost.md). Evidencia smoke: [extraction/docs/hito-1-post-merge-smoke.md](../../extraction/docs/hito-1-post-merge-smoke.md).
- [x] Verificación: tabla **particionada** y **clustered** (screenshot o query a `INFORMATION_SCHEMA` en el PR, sin datos sensibles). — [extraction/docs/hito-1-post-merge-smoke.md](../../extraction/docs/hito-1-post-merge-smoke.md): MONTH(`_sdc_batched_at`) + CLUSTER `empresa`,`idpozo`,`cuenca` con `COUNT(*)=500`. `tables.get` + DDL; queries: `extraction/sql/verify_layout.sql`.
- [ ] Conteo de filas vs source (delta explicado: header, duplicados, filtro). — smoke 500 vs `MAX_RECORDS=500` (delta 0) documentado; Datastore 2025 `total=991844`; falta COUNT del año completo.
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
- [ ] [plan.md](plan.md) Hito 1: casillas de aceptación revisadas (se tildan cuando QA/DE cierran el hito). — smoke 500 + layout OK; año completo pendiente de OK de costo
- [x] No hay `dbt_project.yml` ni app Next en este hito (rechazar scope creep).

## Fuera del checklist Hito 1

- Modelos `stg`/`int`/`marts`, tests dbt, Tremor, hosting del front.
- Convertir m³ → bbl en el tap (la conversión vive en Hito 2 + YAML).
- Schedule Meltano sub-diario / sensores.
- Airflow/Composer.

---

## Hito 2 — IAM + datasets BQ (DE, prereq de dbt)

Evidencia: [transform/docs/hito-2-bq-iam.md](../../transform/docs/hito-2-bq-iam.md). **No** es el PR de modelos.

- [x] Datasets US: `stg_cap4_dev`, `int_cap4_dev`, `marts_cap4_dev`.
- [x] `raw_cap4_dev` existe; `raw_cap4` no.
- [x] SA `vm-pulse-dbt` creada (Nico) + auth `GCP_SA_KEY_DBT`.
- [x] Roles: `jobUser`; `dataViewer` en `raw_cap4_dev`; `dataEditor` en stg/int/marts.
- [x] Docs + `.env.example` con nombres (`DBT_BIGQUERY_PROJECT`, `DBT_DATASET_*`, `GCP_SA_KEY_DBT`).

## Hito 2 — tasa Barrilito (AE, `transform/`) — sin tachar

No implementar modelos dbt en el PR de IAM. Owner: **AE**. Contrato: [data-model.md](data-model.md) § Grano 5.

- [ ] Mart DRAFT `fct_barrilito_rate` (o el nombre único que Hito 2 publique; retirar el alias `mart_barrilito_headline` si no se usa).
- [ ] Grano: **una fila** = snapshot del recorte VM no conv. para el **último mes Capítulo IV** (agregado **total** Pulse, no por empresa).
- [ ] Fórmula preferida: `rate_m3_dia = sum(prod_pet_m3) / sum(tef)` cuando `tef` son días usables y `sum(tef) > 0`.
- [ ] Fallback: `rate_m3_dia = sum(prod_pet_m3) / days_in_month(periodo)`. Tests para `tef` = 0 / nulo. Cerrar preferred vs UNKNOWN con evidencia.
- [ ] Conversión `rate_bbl_dia = rate_m3_dia × 6.28981077` en el modelo.
- [ ] El **mismo** factor `6.28981077` en YAML de métricas dbt (no un segundo número). Documentar en `transform/` README o `dbt_project.yml` / metrics YAML.
- [ ] `stg` materializa `periodo` como grano de negocio; no filtrar el mes Cap. IV por `_sdc_batched_at`.
- [ ] Test de reconciliación: `prod_pet_m3` del mart Barrilito = suma de `fct_well_month` del mismo `periodo` y recorte.
- [ ] Actualizar [data-model.md](data-model.md) si la evidencia cambia preferred/fallback. No inventar sensores ni grano intradía.

---

## Hito 3 — contador + disclaimer (Front, `apps/web/`) — nota only

No implementar Next/Tremor acá ni en Hito 2. Owner: **Front**. Spec: R6 / R6b.

- [ ] Headline = contador de barriles interpolado desde `rate_bbl_dia` del mart (aspecto “extrayéndose” en vivo).
- [ ] Disclaimer **MUST** visible junto al contador: *simulación a partir de datos mensuales oficiales*.
- [ ] Copy: no afirmar telemetría, SCADA, ni que Capítulo IV sea tiempo real / alta frecuencia.
- [ ] Petróleo de headline en **bbl**; m³ disponible en otras vistas si el mart lo expone.
- [ ] README de `apps/web/` documenta mart de tasa + disclaimer (sin secretos en el cliente).
