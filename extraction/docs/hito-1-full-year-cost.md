# Costo — load año completo Cap. IV 2025

**Estado 2026-09-10 (post-OK de Nicolás):** el año **sí se cargó** a `raw_cap4_dev`. Evidencia (COUNT, layout, duración, bytes): [hito-1-full-year-2025-load.md](hito-1-full-year-2025-load.md). Smoke 500 previo: [hito-1-post-merge-smoke.md](hito-1-post-merge-smoke.md).

## Medido en el load real (no extrapolación)

| | |
| --- | ---: |
| `COUNT(*)` | **991 844** (delta 0 vs Datastore) |
| Bytes committed + streaming buffer | **354 871 010** (**338.43 MiB**) |
| Wall-clock Meltano | **13 min 35 s** |
| Destino | `raw_cap4_dev.produccion_pozo_mes` (prod no se tocó) |

El proyecto está en **sandbox GCP** (billing off). No hay factura en USD que cotizar. DML y `partition_expiration > 60 días` están bloqueados.

## Estimación previa (smoke 500, 2026-09-10, conservada)

Antes del OK se midió el smoke de 500 y se extrapoló. El load real (~338 MiB) cayó **dentro** de ese rango.

Auth: `scripts/materialize-sa-key.sh` + `GCP_SA_KEY` (PEM-only → JSON reconstruido). Dataset `raw_cap4_dev`. **No** se habilitó `INFORMATION_SCHEMA.TABLE_STORAGE`. Equivalente a `bq show`: `tables.get` + `streaming_buffer` + `COUNT(*)`.

| Objeto (pre-año) | `COUNT(*)` | `num_rows` meta | `num_bytes` / buffer | Notas |
| --- | ---: | ---: | ---: | --- |
| `produccion_pozo_mes` (tabla **final**, Storage Write API) | **500** | **0** | meta storage **0**; streaming buffer **500 filas / 37 257 bytes** | Layout MONTH(`_sdc_batched_at`) + CLUSTER `empresa,idpozo,cuenca`. |
| `produccion_pozo_mes__20260910185805__…` (staging Bug 1, **no** es producto) | **500** | **500** | **227 414 bytes** committed | Única copia con storage ya materializado en el smoke. |

| Base medida | bytes/fila | × 991 844 | MiB (1024²) |
| --- | ---: | ---: | ---: |
| Streaming buffer Write API (37 257 B / 500) | 74.514 | 73 906 264 | **70.5** |
| Staging committed (227 414 B / 500) | 454.828 | 451 118 423 | **430.2** |
| **Load real 2026-09-10** | ~358 | 354 871 010 | **338.4** |

Caveats de la extrapolación (ya no son el número de producto): 500 filas no eran muestra estratificada; el buffer de streaming es estimado. El rango honesto pre-load era **~70 MiB a ~430 MiB**.

## Volumen (source)

| | |
| --- | --- |
| Resource CKAN 2025 | `d774b5d7-0756-48fe-88f2-8729b57b22da` |
| Destino | `raw_cap4_dev.produccion_pozo_mes`. Prod `raw_cap4` no se toca. |
| Grano | `idpozo + anio + mes` |

## Qué es gratis vs qué hay que mirar

Precios públicos BigQuery ([cloud.google.com/bigquery/pricing](https://cloud.google.com/bigquery/pricing), 2026-09-10). **No es cotización del proyecto.** El pin usa `method: storage_write_api`, **no** un load job clásico.

| Concepto | Lista de precios | Contra los bytes medidos |
| --- | --- | --- |
| **Load jobs clásicos** (shared slot pool) | **Gratis** (después pagás storage) | **No es este camino.** |
| **Storage Write API (gRPC)** | Primeros **2 TiB/mes por cuenta** free; después ~USD 0.025 / GiB | 338 MiB ≪ 2 TiB. Cae en el free de ingest **si** el pin es gRPC **y** la billing account no gastó ese cupo. No afirmamos $0. |
| **Storage Write API (REST) / streaming inserts** | ~USD 0.01 / 200 MiB; **mínimo 1 KiB por fila** | 991 844 × 1 KiB ≈ **0.95 GiB** de ingest facturable, aunque la fila mida ~358 B. Tampoco es load-job gratis. |
| **Storage de tabla** | Primeros **10 GiB/mes** free | 0.33 GiB entra en 10 GiB *si* el resto del proyecto no los come. |
| **Queries on-demand** | Primer **1 TiB/mes** free | `COUNT(*)` + metadata. |
| Free de **queries** vs ingest | El 1 TiB de análisis **no** cubre Write API / streaming | No mezclar cupos. |

## Cadencia

Cap. IV es **mensual**. Cron CI: `0 6 5 * *` (día 5, 06:00 UTC). Barrilito en UI simula intra-mes; **no** hay polling de alta frecuencia. Cada monthly reemit **vuelve a escribir** ~991k filas (TRUNCATE/DELETE/`--recreate` + append) → el ingest se cuenta **cada mes**; el storage queda ~una copia si se limpia antes.

## CI (`ALLOW_FULL_YEAR_LOAD`)

El OK de costo de Nicolás **no** setea la variable de repo. Sin `ALLOW_FULL_YEAR_LOAD=true`, el workflow **sale 1 antes de Meltano** (schedule o dispatch sin `max_records`). Cero writes BQ.

1. Variable de repo Actions: `ALLOW_FULL_YEAR_LOAD=true`.
2. Smoke: `workflow_dispatch` con `max_records=500` (no requiere la variable).

## Qué no es este doc

- No es un USD de factura (sandbox, billing off).
- No flip a `batch_job` (load job gratis, pero el smoke a ~1 rec/s no escala).
