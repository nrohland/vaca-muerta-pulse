# Costo — load año completo Cap. IV 2025

**Estado 2026-09-10 (post-OK de Nicolás):** el año **sí se cargó** a `raw_cap4_dev`. Evidencia (COUNT, layout, duración, bytes): [hito-1-full-year-2025-load.md](hito-1-full-year-2025-load.md).

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

| Base medida (500 filas) | bytes/fila | × 991 844 | MiB |
| --- | ---: | ---: | ---: |
| Streaming buffer Write API (37 257 B / 500) | 74.514 | 73 906 264 | **70.5** |
| Staging committed (227 414 B / 500) | 454.828 | 451 118 423 | **430.2** |
| **Load real 2026-09-10** | ~358 | 354 871 010 | **338.4** |

## Cadencia

Cap. IV es **mensual**. Cron CI: `0 6 5 * *`, gated por `ALLOW_FULL_YEAR_LOAD=true`. Cada reemit vuelve a escribir ~991k filas.
