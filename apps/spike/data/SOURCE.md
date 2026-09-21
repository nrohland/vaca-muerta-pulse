# Spike snapshots — no son raw

Extracto **acotado** de marts Hito 2 (`marts_cap4_dev`). Refresh 2026-09-12 (headline cuenca + Adjunto IV). No es dump de Capítulo IV. No es `raw_*`.

| Archivo | Grano | Filas | Mart origen |
| --- | --- | ---: | --- |
| `headline.csv` | 1 fila Pulse | 1 | `fct_barrilito_rate` — `rate_bbl_dia` = **cuenca** (`calendar_days`, ~590 393); `productivity_bbl_dia` ≈ 260 |
| `monthly_pulse.csv` | mes × recorte VM | 12 | suma de `fct_company_month` |
| `company_latest.csv` | empresa × último mes | 22 | `fct_company_month` |
| `area_latest.csv` | área × último mes | 83 | `fct_area_month` |
| `company_top5_month.csv` | top 5 empresas de dic-2025, todos sus meses 2025 | 59 | `fct_company_month` (sparse) |
| `completions_month.csv` | mes de `fecha_inicio` (Adjunto IV) | 176 | `fct_completions_month` — **105 345** etapas Pulse; **no** es Cap. IV |

Jobs BQ refresh 2026-09-12 (US, SA `vm-pulse-dbt`, sin Meltano): model `876b1821-715d-40ce-a94e-9057c235df1c` (~2.2 MiB); export headline `d68bf2b4-eacd-4d8e-816d-17c5490c21e8`; monthly `37ed464f-ad3b-47aa-ab4f-3d5ce673530d`; company `800191d7-6583-44ea-b7cc-db8aafcc5f3d`; area `c5daa407-94e6-4a67-b15b-8e46076a59cd`; top5 `33ef73b4-49e1-4444-ac45-e4d617d85e68`. Completions export `dda1275e-489c-4e92-bdeb-81b424cbd677`. Raw fracturas load `b7361833-12c9-453e-889a-746ef97008f8`.

Refresh (pide `GOOGLE_APPLICATION_CREDENTIALS` de dbt, nunca `GCP_SA_KEY`):

```bash
cd apps/spike
python export_snapshots.py
```

`well-month` (34 051 filas) **no** entra: el spike no necesita pozo a pozo.
