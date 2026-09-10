# Evidencia — load anual Cap. IV 2025 → `raw_cap4_dev`

**Corrido 2026-09-10.** Dataset **dev** solamente (`raw_cap4` prod no se tocó). Nicolás reconfirmó OK de costo (rango estimado ~70–430 MiB).

## Resultado

| Check | Valor |
| --- | ---: |
| Datastore `total` (resource `d774b5d7-0756-48fe-88f2-8729b57b22da`) | **991 844** |
| `COUNT(*)` `raw_cap4_dev.produccion_pozo_mes` | **991 844** |
| delta (BQ − Datastore) | **0** |
| Grano `idpozo+anio+mes` duplicados | **0** |
| `anio` | min=max=**2025** |
| Meltano `exit_code` | **0** |
| Wall-clock (`ALLOW_FULL_YEAR_LOAD=true MELTANO_ENVIRONMENT=dev meltano run cap4-produccion`) | **13 min 35 s** (20:36:51–20:50:26 UTC) |
| Throughput | **~1 217 rec/s** |
| Páginas CKAN (`page_size=32000`) | 31 (última página 31 844 filas) |
| Staging `produccion_pozo_mes__*` | **ninguna** |

Comando de evidencia (reproducible, sin secretos):

```bash
python scripts/compare_source_count.py --dataset raw_cap4_dev
```

## Layout

DDL de la tabla final (`INFORMATION_SCHEMA.TABLES.ddl` + `tables.get`):

- `PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)`
- `CLUSTER BY empresa, idpozo, cuenca`

**No** es partición por `periodo` (limitación del pin z3z1ma; ver `sql/intended_partition.sql`).

`INFORMATION_SCHEMA.PARTITIONS` al cierre del run mostró `__UNPARTITIONED__` (805 522 filas committed) más streaming buffer. Eso es el camino Storage Write API (`_default` stream): las filas entran al buffer / unpartitioned y BigQuery las acomoda después. El DDL **sí** declara MONTH sobre `_sdc_batched_at`.

## Bytes (medidos, no extrapolados)

`INFORMATION_SCHEMA.TABLE_STORAGE` sigue sin habilitarse (no corrimos `ALTER PROJECT`). Equivalente a `bq show`: `tables.get` + streaming buffer.

| | filas | bytes | MiB (1024²) |
| --- | ---: | ---: | ---: |
| Storage committed (`num_rows` / `num_bytes`) | 805 522 | 341 455 549 | **325.64** |
| Streaming buffer | 186 322 | 13 415 461 | **12.79** |
| **Suma al cierre del run** | **991 844** | **354 871 010** | **338.43** |

Cae **adentro** del rango autorizado ~70–430 MiB. No es un USD de factura: el proyecto está en **sandbox** (ver abajo).

## Cómo se corrió (reemit limpio)

`TRUNCATE` / `DELETE` devolvieron `403 DML queries are not allowed in the free tier`. Reemit en sandbox = **DROP + CREATE** (DDL) con el mismo SQL de MONTH+CLUSTER, después append:

```bash
cd extraction
source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-sa-key.sh)"
unset TAP_CKAN_DATASTORE_MAX_RECORDS
python scripts/prepare_year_load.py --dataset raw_cap4_dev --recreate
ALLOW_FULL_YEAR_LOAD=true MELTANO_ENVIRONMENT=dev meltano run cap4-produccion
python scripts/compare_source_count.py --dataset raw_cap4_dev
```

## Bugs que este run cerró

1. **Schema CKAN por fila.** Singer SDK lee `stream.schema` en cada RECORD. El tap pegaba `datastore_search(limit=0)` ~1 rec/s (991k ≈ días). Cache en `self._schema`. Primer intento abortado a 323 filas; se recreó la tabla y se re-corrió.
2. **Bug 1 overwrite** no reapareció: `overwrite:false`, tabla final = 991 844, cero staging.
3. **Bug 2 throughput:** con schema cacheado, Storage Write API a batches de 500 sostuvo ~1.2k rec/s.

## Límites del sandbox GCP (honestos)

- Billing **no** está prendido. DML (TRUNCATE/DELETE/MERGE) prohibido.
- `default_partition_expiration_ms` del dataset = **60 días**. `ALTER … partition_expiration_days = NULL` falla: *“Partition expiration time must be less than 60 days while in sandbox mode.”*
- Las filas de este load **vencen ~60 días** después de la fecha de partición (`_sdc_batched_at`), salvo que se habilite billing y se saque el cap.

Prod `raw_cap4` no se tocó.

## CI

El workflow mensual (`0 6 5 * *`) sigue pidiendo `ALLOW_FULL_YEAR_LOAD=true` (variable de repo). El OK de costo de Nicolás **no** setea esa variable solo: hay que ponerla en Actions para que el cron no salga 1.
