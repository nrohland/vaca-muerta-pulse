# Costo estimado — load año completo Cap. IV 2025

**Estado 2026-09-10:** el año completo **no se corrió** (ni Meltano, ni Storage Write de 991k). MUST: cero gasto GCP extra sin OK de Nicolás. Este archivo trae **bytes medidos** del smoke de 500 y una extrapolación lineal; **no** afirma `COUNT(*)` = 991 844 en BQ ni un USD de factura.

## Medición (metadata, 2026-09-10)

Auth: `scripts/materialize-sa-key.sh` + `GCP_SA_KEY` (PEM-only → JSON reconstruido). Dataset `raw_cap4_dev`. **No** se habilitó `INFORMATION_SCHEMA.TABLE_STORAGE` (`ALTER PROJECT … enable_info_schema_storage`); esa vista no está prendida. Equivalente a `bq show`: `tables.get` + `streaming_buffer` + `COUNT(*)`.

| Objeto | `COUNT(*)` | `num_rows` meta | `num_bytes` / buffer | Notas |
| --- | ---: | ---: | ---: | --- |
| `produccion_pozo_mes` (tabla **final**, Storage Write API) | **500** | **0** | meta storage **0**; streaming buffer **500 filas / 37 257 bytes** | Layout MONTH(`_sdc_batched_at`) + CLUSTER `empresa,idpozo,cuenca`. Las 500 del smoke **siguen en el buffer de streaming** (por eso `num_rows`/`num_bytes` de `tables.get` dan 0). |
| `produccion_pozo_mes__20260910185805__…` (staging Bug 1, **no** es producto) | **500** | **500** | **227 414 bytes** committed | Única copia con storage ya materializado. No usarla como tabla de producto. |

`INFORMATION_SCHEMA.PARTITIONS` de la final: vacío (esperable con filas solo en streaming buffer).

## Extrapolación lineal → 991 844 filas

Datastore 2025 `total` = **991 844** (API pública, mismo día). Fórmula: `bytes_per_row = measured_bytes / 500`, luego `× 991844`.

| Base medida | bytes/fila | × 991 844 | MiB (1024²) | GiB (1024³) |
| --- | ---: | ---: | ---: | ---: |
| Streaming buffer de la **final** (Write API, 37 257 B / 500) | **74.514** | **73 906 264** | **70.5 MiB** | **0.069 GiB** |
| Staging committed (227 414 B / 500) | **454.828** | **451 118 423** | **430.2 MiB** | **0.420 GiB** |
| Piso REST streaming (1 KiB min/fila, lista de precios) | 1024 | **1 015 648 256** | **968.6 MiB** | **0.946 GiB** |

Caveats: 500 filas no son una muestra estratificada del año; el buffer de streaming es **estimado**; el storage columnar committed de la final todavía no apareció en `num_bytes`. El rango honesto para **un** año en disco es **~70 MiB a ~430 MiB** (orden **< 1 GiB**), no decenas de GiB. El piso 1 KiB/fila solo aplica si el ingest se factura como REST streaming.

## Volumen (source)

| | |
| --- | --- |
| Resource CKAN 2025 | `d774b5d7-0756-48fe-88f2-8729b57b22da` |
| Destino propuesto | `raw_cap4_dev.produccion_pozo_mes`. Prod `raw_cap4` no se toca. |
| Grano | `idpozo + anio + mes` |

## Qué es gratis vs qué hay que mirar

Precios públicos BigQuery ([cloud.google.com/bigquery/pricing](https://cloud.google.com/bigquery/pricing), 2026-09-10). **No es cotización del proyecto.** El pin usa `method: storage_write_api`, **no** un load job clásico.

| Concepto | Lista de precios | Contra los bytes medidos |
| --- | --- | --- |
| **Load jobs clásicos** (shared slot pool) | **Gratis** (después pagás storage) | **No es este camino.** |
| **Storage Write API (gRPC)** | Primeros **2 TiB/mes por cuenta** free; después ~USD 0.025 / GiB | 70 MiB–430 MiB ≪ 2 TiB. Cae en el free de ingest **si** el pin es gRPC **y** la billing account no gastó ese cupo. No afirmamos $0. |
| **Storage Write API (REST) / streaming inserts** | ~USD 0.01 / 200 MiB; **mínimo 1 KiB por fila** | 991 844 × 1 KiB ≈ **0.95 GiB** de ingest facturable, aunque la fila mida 75–455 B. Tampoco es load-job gratis. |
| **Storage de tabla** | Primeros **10 GiB/mes** free | 0.07–0.42 GiB entra en 10 GiB *si* el resto del proyecto no los come. |
| **Queries on-demand** | Primer **1 TiB/mes** free | Esta medición fue metadata + `COUNT(*)` de 500 filas. |
| Free de **queries** vs ingest | El 1 TiB de análisis **no** cubre Write API / streaming | No mezclar cupos. |

## Cadencia

Cap. IV es **mensual**. Cron previsto: `0 6 5 * *` (día 5, 06:00 UTC). Barrilito en UI simula intra-mes; **no** hay polling de alta frecuencia. Cada monthly reemit **vuelve a escribir** ~991k filas (TRUNCATE/DELETE + append) → el ingest se cuenta **cada mes**; el storage queda ~una copia si se limpia antes.

## Cómo desbloquear (después del OK de Nico)

1. Variable de repo Actions: `ALLOW_FULL_YEAR_LOAD=true`.
2. Sin esa variable, el workflow **sale 1 antes de Meltano** (schedule o dispatch sin `max_records`). Cero writes BQ.
3. Smoke: `workflow_dispatch` con `max_records=500` (no requiere la variable).

## Qué no es este doc

- No es evidencia de año completo en BQ.
- No es luz verde de billing.
- No flip a `batch_job` (load job gratis, pero el smoke a ~1 rec/s no escala).
