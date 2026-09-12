# Spike snapshots — no son raw

Extracto **acotado** de marts Hito 2 (`marts_cap4_dev`), 2026-09-11. No es dump de Capítulo IV. No es `raw_*`.

| Archivo | Grano | Filas | Mart origen |
| --- | --- | ---: | --- |
`headline.csv` se exportó **antes** de la revisión de grano: `rate_bbl_dia` / `rate_method=tef_weighted` son **productividad** (~260 bbl/pozo-día). El spike v2 (`barrilito_cuenca.ipynb`) recalcula la tasa de cuenca desde `prod_pet_m3 / days_in_month`. Después de `dbt build` + este script, `rate_bbl_dia` pasa a ser cuenca y aparecen `productivity_*`.
| `monthly_pulse.csv` | mes × recorte VM | 12 | suma de `fct_company_month` |
| `company_latest.csv` | empresa × último mes | 22 | `fct_company_month` |
| `area_latest.csv` | área × último mes | 83 | `fct_area_month` |
| `company_top5_month.csv` | top 5 empresas de dic-2025, todos sus meses 2025 | 59 | `fct_company_month` (sparse) |

Jobs BQ (US, SA `vm-pulse-dbt`, sin Meltano): headline `2f9ec073-482c-40b0-b68c-fc8a4c332544`; monthly `d15375c5-b021-4b4d-8367-b8837ac00d0f`; company `4e14f727-e0c6-4e98-ba7f-7a04deccc6b6`; area `127cf1cb-e815-40e3-9f73-3e4651d6340e`; top5 `162b8f67-31a3-4c5b-afde-1053f5960455`.

Refresh (pide `GOOGLE_APPLICATION_CREDENTIALS` de dbt, nunca `GCP_SA_KEY`):

```bash
cd apps/spike
python export_snapshots.py
```

`well-month` (34 051 filas) **no** entra: el spike no necesita pozo a pozo.
