# apps/spike — mock de portada Barrilito

**No es Hito 3.** Owner: AE / producto. El dashboard público sigue en [`apps/web/`](../web/README.md) (Next.js + Tremor, vacío hasta el hito).

Este folder es un **spike**: notebooks + CSVs chicos de marts para fijar interpolación, copy, gráficos y tokens. ADR: [0002](../../docs/adrs/0002-ui-spike-notebook.md). No reemplaza el [0001](../../docs/adrs/0001-stack-choices.md).

| Notebook | Headline | Usar |
| --- | --- | --- |
| [`barrilito_cuenca.ipynb`](barrilito_cuenca.ipynb) | **bbl/día de cuenca** = `prod_pet_m3 / days_in_month` (~590k en dic-2025) | **Sí** — definición actual |
| [`barrilito_spike.ipynb`](barrilito_spike.ipynb) | usaba `rate_bbl_dia` del mart = `prod / tef` (~260 bbl/pozo-día) | Histórico; no copiar al Front |

## Cómo correr

```bash
cd apps/spike
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
jupyter notebook barrilito_cuenca.ipynb
```

No hace falta GCP: los CSV ya están en [`data/`](data/SOURCE.md). Cero secretos. El notebook **v2 no lee** `headline.rate_bbl_dia` (sigue siendo el grano viejo hasta que Nico corra `dbt build` + `export_snapshots.py`).

Refresh opcional (SA `vm-pulse-dbt`, **no** Meltano `GCP_SA_KEY`):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/vm-pulse-dbt.json
pip install google-cloud-bigquery pandas pyarrow
python export_snapshots.py
```

## Qué queda fijado acá (v2)

- Headline: `rate_bbl_cuenca = prod_pet_m3 × 6.28981077 / days_in_month`.
- Productividad: `prod × factor / tef_sum` como KPI, **no** como ritmo del contador.
- Reloj diario: `barriles_hoy = rate_bbl_cuenca × segundos_desde_00:00_ART / 86400`.
- Disclaimer MUST pegado al número: *simulación a partir de datos mensuales oficiales*.
- Copy: **último mes oficial** (dic-2025), no “últimos 30 días” como si Cap. IV fuera diario.
- Completaciones / rigs / Brent / export / oleoductos / breakeven = no están en estos CSV.

## Qué no es

- No es Streamlit como producto.
- No lee `raw_*`.
- No cierra aceptación de [plan.md](../../specs/001-vaca-muerta-pulse/plan.md) Hito 3.
- No arranca Next.
