# Adjunto IV load — evidence (dev)

**Not Capítulo IV.** Resource `2280ad92-6ed3-403e-a095-50139863ab0d`. No secrets in this file.

| | |
| --- | --- |
| When | 2026-09-12 |
| Project / location | `vaca-muerta-pulse` / US |
| Raw table | `raw_cap4_dev.fracturas_adjunto_iv` |
| Path | Python loader (`scripts/load_fracturas_datastore.py`) after `prepare_fracturas_load.py --recreate`. Meltano SA (`GCP_SA_KEY`) was not in this environment; job `cap4-fracturas` is the documented DE path. |
| Load job | `b7361833-12c9-453e-889a-746ef97008f8` |
| Create table job | `9419a1de-bc32-4a40-926c-e8130e650c89` |
| `COUNT(*)` raw | **4890** (unique `id_base_fractura_adjiv` = 4890; matches Datastore total) |
| Layout | `PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)` + `CLUSTER BY idpozo, cuenca, empresa_informante`. Sandbox still stamps `partition_expiration_days=60`. **No** partition on `fecha_inicio_fractura`. |
| Pulse cut (stg) | `formacion_productiva='vaca muerta'` AND `tipo_reservorio='NO CONVENCIONAL'` → **2999** jobs (2995 SHALE + 2 TIGHT + 2 blank subtipo) |
| `fct_completions` | **2999** rows |
| `fct_completions_month` | **176** months, `2011-12-01` → `2026-12-01`, **105 345** etapas |
| `dbt build --select stg_fracturas_adjunto_iv+` | PASS=17 WARN=0 (2026-09-12). Model `fct_completions` CREATE TABLE 3.0k rows, ~1.3 MiB processed |

Join to `fct_well_month` on `idpozo` remains **UNKNOWN** (no `relationships` test).

Copy: Adjunto IV, not Cap. IV. Future `fecha_inicio` values exist in the source (max 2026-12-05 on this load); staging does not drop them.
