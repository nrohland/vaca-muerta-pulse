# transform/ — dbt (Analytics Engineer)

**Hito 2 (este PR): IAM / datasets BQ.** Owner: **AE** (ops DE+Nico para SA). Producto UI: **Barrilito**.

**No hay `dbt_project.yml` en este árbol.** Los modelos `stg` → `int` → `marts` van en el PR de AE de Hito 2, no acá. Este folder ahora documenta el **contrato físico** de BigQuery (datasets ya creados) y cómo Nicolás crea la SA `vm-pulse-dbt` **sin** mezclarla con Meltano.

Evidencia warehouse: [docs/hito-2-bq-iam.md](docs/hito-2-bq-iam.md).

---

## Estado 2026-09-10 (honesto)

| Recurso | Estado |
| --- | --- |
| `stg_cap4_dev` | **existe** (US, vacío) |
| `int_cap4_dev` | **existe** (US, vacío) |
| `marts_cap4_dev` | **existe** (US, vacío) |
| `raw_cap4_dev` | **existe** (Hito 1; Meltano escribe) |
| `raw_cap4` | **no existe** |
| SA `vm-pulse-dbt` | **no existe** (IAM API off / Meltano no puede crearla) |
| Secret `GCP_SA_KEY_DBT` | pendiente de Nico (distinto de Meltano `GCP_SA_KEY`) |

No se afirma que dbt pueda autenticar. No se corrió `dbt build`.

---

## Datasets

| Capa | Dev (Hito 2) | Prod twin (futuro; no creado) | Quién escribe |
| --- | --- | --- | --- |
| Source Meltano | `raw_cap4_dev` | `raw_cap4` | `vm-pulse-meltano` |
| Staging | `stg_cap4_dev` | `stg_cap4` | `vm-pulse-dbt` (cuando exista) |
| Intermediate | `int_cap4_dev` | `int_cap4` | idem |
| Marts (Front) | `marts_cap4_dev` | `marts_cap4` | idem |

Location: **US**. Proyecto: el mismo que Hito 1 (`extraction/.env.example`).

IAM mínimo de `vm-pulse-dbt` (a aplicar por Nico):

- `roles/bigquery.jobUser` a nivel proyecto
- READER en `raw_cap4_dev`
- WRITER en `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev`
- JSON de la key **fuera de git**

Aviso: esos datasets heredaron **expiración default de tablas = 60 días**. Ver evidencia.

---

## Scripts (sin secretos)

| Script | Para qué |
| --- | --- |
| [scripts/provision_hito2_bq.sh](scripts/provision_hito2_bq.sh) | Nico: crear SA + grants; `--verify-only` lista datasets |
| [scripts/provision_hito2_bq.py](scripts/provision_hito2_bq.py) | implementación (bq + REST IAM) |
| [scripts/materialize-dbt-sa-key.sh](scripts/materialize-dbt-sa-key.sh) | runtime: `GCP_SA_KEY_DBT` → `.secrets/vm-pulse-dbt.json` |

Patrón calcado de [extraction/scripts/materialize-sa-key.sh](../extraction/scripts/materialize-sa-key.sh), **con otro env var**. El script de dbt **rechaza** `GCP_SA_KEY` de Meltano a propósito.

### Verificar datasets (Meltano SA alcanza)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(bash extraction/scripts/materialize-sa-key.sh)"
bash transform/scripts/provision_hito2_bq.sh --verify-only
# exit 2 mientras la SA dbt no exista — es el resultado esperado hoy
```

### Crear SA + key (solo Nicolás)

```bash
cd transform
# credenciales de *tu user* GCP (owner), no de vm-pulse-meltano
bash scripts/provision_hito2_bq.sh \
  --unset-table-expiration \
  --tighten-acl \
  --create-key .secrets/vm-pulse-dbt.json
```

Después, el JSON completo va al secret de GitHub **`GCP_SA_KEY_DBT`** (Settings → Secrets → Actions). Meltano sigue en **`GCP_SA_KEY`**.

Local / CI, una vez que el secret exista:

```bash
cd transform
cp .env.example .env   # nombres nomas; gitignored
export GCP_SA_KEY_DBT='<JSON completo de vm-pulse-dbt>'
export GOOGLE_APPLICATION_CREDENTIALS="$(bash scripts/materialize-dbt-sa-key.sh)"
# dbt debug / build viven en el PR de modelos, no en este
```

Si el store solo tiene el PEM: `GCP_SA_DBT_CLIENT_EMAIL=vm-pulse-dbt@<project-id>.iam.gserviceaccount.com` (o `BIGQUERY_PROJECT`).

---

## Qué no hay que hacer acá

- Scaffold de `dbt_project.yml` / modelos “para adelantar” en este PR de IAM
- Reusar la key de Meltano para dbt
- Commitear `.env`, `vm-pulse-dbt.json`, ni el body de un secret
- Afirmar que `vm-pulse-dbt` existe
- Crear `raw_cap4` ni twins prod
- `dbt build` grande contra el año Cap. IV

Referencias:

- [docs/architecture.md](../docs/architecture.md)
- [docs/adrs/0001-stack-choices.md](../docs/adrs/0001-stack-choices.md)
- [specs/001-vaca-muerta-pulse/plan.md](../specs/001-vaca-muerta-pulse/plan.md)
- [extraction/README.md](../extraction/README.md) (raw; no transformar acá)
