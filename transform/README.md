# transform/ — dbt (Analytics Engineer)

**Hito 2 — IAM + datasets (este PR).** Owner: **AE** para modelos; **DE** para el warehouse. **No** hay `dbt_project.yml` acá: eso es el PR de modelos, no este.

Producto: **Barrilito**. Granos: [data-model.md](../specs/README.md) (spec 001). Stack: [architecture.md](../docs/architecture.md).

---

## ¿Hay que crear la SA `vm-pulse-dbt`?

**Sí.** Es la cuenta de dbt. No reutilices la SA ni la key de Meltano (`vm-pulse-meltano` / `GCP_SA_KEY`).

| Por qué | Detalle |
| --- | --- |
| Least privilege | Meltano **escribe** `raw_*`. dbt **lee** raw y **escribe** `stg` / `int` / `marts`. Misma key = dbt con write a raw. |
| Secretos | GitHub / Cursor: `GCP_SA_KEY_DBT` **aparte** de `GCP_SA_KEY`. |
| Grants | BigQuery no deja colgar `dataViewer` / `dataEditor` a un email que no existe. |

**Creada** (Nico + menú secrets). Datasets dbt existen. Roles verificados: [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md). IAM API sigue apagada para estas SAs; los grants de dataset los colgó Meltano (OWNER). Key: `GCP_SA_KEY_DBT` — **nunca** en git.

---

## Warehouse (confirmado 2026-09-10)

Proyecto: `$BIGQUERY_PROJECT`. Location: **US** (multi-region).

| Dataset | Estado | Quién escribe |
| --- | --- | --- |
| `raw_cap4_dev` | existe (Hito 1) | Meltano |
| `raw_cap4` | **no existe** todavía | Meltano (prod, cuando se cree) |
| `stg_cap4_dev` | **creado** US | dbt |
| `int_cap4_dev` | **creado** US | dbt |
| `marts_cap4_dev` | **creado** US | dbt |

Roles de `vm-pulse-dbt@$BIGQUERY_PROJECT.iam.gserviceaccount.com` (**verificados** 2026-09-10):

- Proyecto: `roles/bigquery.jobUser` (job de `INFORMATION_SCHEMA.SCHEMATA` OK)
- `raw_cap4_dev`: `roles/bigquery.dataViewer` (READER; `list_tables` sin scan)
- `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev`: `roles/bigquery.dataEditor` (WRITER; create+drop tabla 0 filas)
- `raw_cap4`: no existe todavía

La SA de Meltano quedó **OWNER** de los datasets dbt porque los creó. No escribe modelos ahí.

---

## Env (nombres, cero keys)

Copiá [`.env.example`](.env.example) a `transform/.env` (gitignored) o exportá las vars. **Solo nombres** en git.

| Variable | Para qué |
| --- | --- |
| `DBT_BIGQUERY_PROJECT` | Proyecto BQ (`$BIGQUERY_PROJECT`). Alias de `BIGQUERY_PROJECT`. |
| `BIGQUERY_LOCATION` | `US` |
| `DBT_DATASET_RAW` | Source Hito 2: `raw_cap4_dev` |
| `DBT_DATASET_STG` | `stg_cap4_dev` |
| `DBT_DATASET_INT` | `int_cap4_dev` |
| `DBT_DATASET_MARTS` | `marts_cap4_dev` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path a un JSON **gitignored** (p.ej. `./.secrets/vm-pulse-dbt.json`) |
| `GCP_SA_KEY_DBT` | Secret de CI / Cloud: JSON **completo** de la key de `vm-pulse-dbt`. **No** es `GCP_SA_KEY` (Meltano). |

Local, si Nico creó una key (opcional; preferible ADC / WIF):

```bash
cd transform
mkdir -p .secrets                          # .secrets/ está gitignored
# el JSON vive acá o en GH Secrets — nunca en el commit
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/.secrets/vm-pulse-dbt.json"
# o, si el secret está en el entorno:
export GCP_SA_KEY="$GCP_SA_KEY_DBT"
export GCP_SA_CLIENT_EMAIL=vm-pulse-dbt@<project-id>.iam.gserviceaccount.com
export SA_KEY_PATH="$PWD/.secrets/vm-pulse-dbt.json"
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-dbt-sa-key.sh)"
```

### Cursor Cloud / GitHub (el menú de secrets)

Mismo patrón que Meltano (`GCP_SA_KEY` → `scripts/materialize-sa-key.sh`):

1. En el run del agente aparece el menú **Add secrets**.
2. Pegá el JSON **entero** de la key (de `{` a `}`) en **`GCP_SA_KEY_DBT`**.
3. Si solo tenés el PEM, pegá también **`GCP_SA_CLIENT_EMAIL_DBT`** = `vm-pulse-dbt@<project-id>.iam.gserviceaccount.com`.
4. El script materializa a `transform/.secrets/vm-pulse-dbt.json` (gitignored).

Si la SA todavía no existe, el mismo menú acepta el JSON de una SA **owner** (puede habilitar IAM y crear `vm-pulse-dbt`). No reutilices `GCP_SA_KEY` de Meltano.

Este PR **no** descarga ni commitea un JSON de SA.

---

## Qué no hay en este PR

- Modelos dbt (`stg` → `int` → `marts`), `dbt_project.yml`, `dbt build`.
- Full scans / `COUNT(*)` de `raw_cap4_dev.produccion_pozo_mes`.
- Key de `vm-pulse-dbt` (Nico la guarda afuera, si hace falta).

Referencias: [plan.md](../specs/README.md) Hito 2 · [extraction/README.md](../extraction/README.md) (SA Meltano, distinta).
