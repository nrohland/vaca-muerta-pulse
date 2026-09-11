# apps/spike — mock de portada Barrilito

**No es Hito 3.** Owner: AE / producto. El dashboard público sigue en [`apps/web/`](../web/README.md) (Next.js + Tremor, vacío hasta el hito).

Este folder es un **spike**: notebook + CSVs chicos de marts para fijar interpolación, copy, gráficos y tokens. ADR: [0002](../../docs/adrs/0002-ui-spike-notebook.md). No reemplaza el [0001](../../docs/adrs/0001-stack-choices.md).

## Cómo correr

```bash
cd apps/spike
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
jupyter notebook barrilito_spike.ipynb
```

No hace falta GCP: los CSV ya están en [`data/`](data/SOURCE.md). Cero secretos.

Refresh opcional (SA `vm-pulse-dbt`, **no** Meltano `GCP_SA_KEY`):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/vm-pulse-dbt.json
pip install google-cloud-bigquery pandas pyarrow
python export_snapshots.py
```

## Qué queda fijado acá

- Reloj diario: `barriles_hoy = rate_bbl_dia × segundos_desde_00:00_ART / 86400`.
- Disclaimer MUST pegado al número: *simulación a partir de datos mensuales oficiales*.
- Petróleo headline en **bbl**; volumen DDJJ en **m³**.
- Ranking empresas + áreas (permiso/concesión). Completaciones = “sin dato”.
- Paleta y mapa de componentes → Tremor (celda 8 del notebook).

## Qué no es

- No es Streamlit como producto.
- No lee `raw_*`.
- No cierra aceptación de [plan.md](../../specs/001-vaca-muerta-pulse/plan.md) Hito 3.
