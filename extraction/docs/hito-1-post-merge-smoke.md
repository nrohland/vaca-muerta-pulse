# Evidencia smoke Hito 1 (post-merge PR #5)

Corrida **2026-09-10** contra el HEAD que recibió el merge de PR #5
(`30f6970` en `cursor/hito-1-bigquery-credentials-ci-8d0b`). Evidencia de esa
corrida; **no** se re-ejecutó el load. `main` posterior (#4 credenciales CI,
#8 cron/costo) no cambia estos números. **No se commitearon secretos.**

## Resultado

| Check | Resultado |
| --- | --- |
| Auth SA `vm-pulse-meltano` | OK (ADC vía `scripts/materialize-sa-key.sh`; `GCP_SA_KEY` era PEM-only, JSON reconstruido con `GCP_SA_CLIENT_EMAIL` documentado) |
| Dataset | `raw_cap4_dev` ya existía |
| `meltano install` | 2/2 plugins OK (Meltano 4.2.2) |
| `prepare_year_load.py --dataset raw_cap4_dev` | tabla ya existía; DDL MONTH + CLUSTER OK |
| `meltano run cap4-produccion` | exit 0 |
| `COUNT(*)` `raw_cap4_dev.produccion_pozo_mes` | **500** (> 0) |
| Layout | `PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)` + `CLUSTER BY empresa, idpozo, cuenca` |
| Destino del load | tabla **final** (Storage Write API: 306 + 194 filas a `…/tables/produccion_pozo_mes/streams/_default`). No es el staging `__*` |
| Duración | **504 s** wall-clock (start `19:34:39Z` → end `19:43:03Z`); tap `sync_duration` 494.9 s |
| Año completo | **no** en esta corrida (`MAX_RECORDS=500`). Datastore 2025 `total` 991 844. Load anual posterior: [hito-1-full-year-2025-load.md](hito-1-full-year-2025-load.md) |

Pre-smoke: `COUNT(*)` = **0** (Bug 1 del handoff). Post-smoke: **500**.

## Comando

```bash
cd extraction
source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-sa-key.sh)"
python scripts/prepare_year_load.py --dataset raw_cap4_dev
TAP_CKAN_DATASTORE_PAGE_SIZE=500 TAP_CKAN_DATASTORE_MAX_RECORDS=500 \
  MELTANO_ENVIRONMENT=dev meltano run cap4-produccion
```

Resource CKAN (público): `d774b5d7-0756-48fe-88f2-8729b57b22da` (producción 2025).
Cap: 500 filas pedidas / 500 RECORD en el target / `COUNT(*)` = 500. Delta vs source
del smoke = 0. No es el smoke de un año.

## COUNT(*)

```sql
SELECT COUNT(*) AS row_count
FROM `raw_cap4_dev.produccion_pozo_mes`;
```

```
row_count = 500
```

Grano del sample (sin PII): `anio=2025`, `mes=1–10`, `DISTINCT idpozo=275`,
`DISTINCT cuenca=3`.

## Layout (`INFORMATION_SCHEMA.TABLES.ddl`)

Snippet físico (el `OPTIONS(description=…)` generado por el target se omite; no
tiene secretos, solo el schema Singer):

```sql
CREATE TABLE `…raw_cap4_dev.produccion_pozo_mes`
(
  … columnas Cap. IV + _sdc_* …
  _sdc_batched_at TIMESTAMP,
  …
)
PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)
CLUSTER BY empresa, idpozo, cuenca
```

Confirmado también por `google.cloud.bigquery` `Table.time_partitioning` /
`clustering_fields`:

- `partition_type=MONTH`
- `partition_field=_sdc_batched_at`
- `clustering_fields=['empresa', 'idpozo', 'cuenca']`

`INFORMATION_SCHEMA.CLUSTERING_COLUMNS` y `INFORMATION_SCHEMA.PARTITIONS`
devolvieron 404 / vacío en esta VM (vistas no disponibles o buffer de Storage
Write). El DDL + el API de tabla son la evidencia de layout. **No** se afirma
partición por `periodo`.

## Loader log (sin secretos)

- Target: `target-bigquery v0.7.2` — `Reader completed processing 502 lines of input (1 schemas, 500 records, …)`.
- Write 1: `Sent 306 rows to …/raw_cap4_dev/tables/produccion_pozo_mes/streams/_default`.
- Write 2: `…/tables/produccion_pozo_mes`: 194.
- Meltano: `Run completed`.

Throughput: ~1 rec/s de pared (similar al handoff `batch_job`). El cuello visible
fue el tap (~60 RECORD/min) y el drain a los 5 min de max-age del sink; el write
a la tabla final vía Storage Write API sí aterrizó. Un año (~992k) **no** se
midió acá.

## Staging leftover (Bug 1 previo)

Sigue existiendo `produccion_pozo_mes__20260910185805__…` del overwrite roto.
No es la tabla de producto. Safe to `DROP` cuando QA quiera; este smoke **no**
la tocó.

## Fuera de alcance

- Load de año completo: **fuera de esta corrida** (cap 500). Posterior: [hito-1-full-year-2025-load.md](hito-1-full-year-2025-load.md).
- dbt / Next.js.
- Recrear SAs.
