# Tasks — Hito 1 (raw BigQuery + Meltano)

Solo **Hito 1**. Hitos 2–3 no se tachan acá. Criterios de aceptación: [plan.md](plan.md). Owner: **DE**. Folder: [`extraction/`](../../extraction/README.md).

Todas las casillas empiezan **sin** marcar. Tachá en el PR que complete el ítem.

## GCP y BigQuery

- [ ] Proyecto GCP del Pulse documentado (id del proyecto, región, **sin** keys).
- [ ] APIs: BigQuery (+ IAM lo mínimo). Billing/alerta de presupuesto mencionadas en `extraction/README.md`.
- [ ] Dataset raw creado (nombre propuesto `raw_cap4`; si cambia, update [architecture.md](../../docs/architecture.md)).
- [ ] Service account de Meltano: rol mínimo de **escritura** a `raw_*`; JSON **fuera** del repo (`GOOGLE_APPLICATION_CREDENTIALS` o Secret Manager).
- [ ] `.env.example` (opcional) con **nombres** de variables, cero secretos.

## Diseño físico de la tabla de producción

- [ ] Decisión documentada: partition column (`DATE` de período vs otra).
- [ ] Decisión documentada: `CLUSTER BY` (orden de columnas).
- [ ] Convención de nombres de tabla raw (1:1 con el stream del tap).
- [ ] Estrategia si el CSV anual se **reemite** (truncate partition vs append + `rectificado`): escrita en `extraction/README.md` o data-model.

## Meltano

- [ ] Proyecto Meltano inicializado **en** `extraction/` (no en la raíz salvo ADR).
- [ ] `meltano.yml` versionado; plugins pinned de forma reproducible.
- [ ] Tap elegido y justificado en README (CKAN Datastore vs CSV anual vs tap-rest). **Sin** scraper del HTML de consulta avanzada.
- [ ] `target-bigquery` (o equivalente Singer a BQ) configurado con partition/cluster.
- [ ] Environments `dev` / `prod` o equivalente; credenciales por env, no hardcode.
- [ ] Comando documentado: un `meltano run` (o `make extract`) que un contributor puede copiar.
- [ ] Resource IDs / URLs del Capítulo IV listados (producción por año mínimo).

## Loads de smoke

- [ ] Load de **al menos un año** de producción pozo-mes a BQ.
- [ ] Verificación: tabla **particionada** y **clustered** (screenshot o query a `INFORMATION_SCHEMA` en el PR, sin datos sensibles).
- [ ] Conteo de filas vs source (delta explicado: header, duplicados, filtro).
- [ ] Sample de columnas reales vs lista draft: PR actualiza [data-model.md](data-model.md) (CONFIRMED / UNKNOWN).

## Padrón y completaciones (descubrimiento, no dbt)

- [ ] ¿El CSV de producción ya trae dims de pozo suficientes? Documentar sí/no.
- [ ] Si hace falta padrón/pozos aparte: tap extra **o** tarea explícita “no en Hito 1” con motivo.
- [ ] Completaciones/fracturas: encontrar resource **o** escribir en data-model + spec que v1 no tiene source (empty state Hito 3).
- [ ] Si hay source de completaciones: load raw smoke **o** issue/task residual linkeada; no silenciar.

## Higiene y DoD Hito 1

- [ ] `extraction/README.md` reescrito para un humano que clona el repo (prereqs Python, Meltano, GCP).
- [ ] `.gitignore` cubre `.meltano/`, outputs, keys (ajustar si el init crea paths nuevos).
- [ ] Ningún CSV pesado commiteado.
- [ ] Ningún JSON de SA, ningún `.env` real.
- [ ] [plan.md](plan.md) Hito 1: casillas de aceptación revisadas (se tildan cuando QA/DE cierran el hito).
- [ ] No hay `dbt_project.yml` ni app Next en este hito (rechazar scope creep).

## Fuera de este checklist

- Modelos `stg`/`int`/`marts`, tests dbt, Tremor, hosting del front.
- Convertir m³ → bbl en el tap.
- Airflow/Composer.
