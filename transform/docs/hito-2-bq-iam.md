# Evidencia IAM Hito 2 — datasets BQ + SA dbt

Corrida de verificación **2026-09-10** contra el proyecto GCP de Hito 1 (`extraction/.env.example`) (location **US**).

**Estado honesto (post Nico):** SA `vm-pulse-dbt` **fue creada por Nico**. Bindings OK. Secret `GCP_SA_KEY_DBT` (JSON completo; materializado a `transform/.secrets/vm-pulse-dbt.json`, gitignored). Distinto de Meltano `GCP_SA_KEY`. **No se commitearon secretos.** `dbt build` contra warehouse no se afirma acá (modelos Barrilito viven en `transform/` desde PR #10).

Scripts: [provision_hito2_bq.sh](../scripts/provision_hito2_bq.sh) (`--verify-only` lista datasets + SA) y [materialize-dbt-sa-key.sh](../scripts/materialize-dbt-sa-key.sh) (rechaza `GCP_SA_KEY` de Meltano).

## Resultado

| Check | Resultado (2026-09-10) |
| --- | --- |
| Auth SA `vm-pulse-meltano` | OK (ADC vía materialize Meltano; usó para listar datasets) |
| Auth SA `vm-pulse-dbt` | **OK** — Nico creó la SA + secret `GCP_SA_KEY_DBT` |
| `raw_cap4_dev` | **existe**, location **US**, created `2026-09-10T18:11:40Z`. Tabla `produccion_pozo_mes` (`COUNT(*)` = 991844, handoff Hito 1) |
| `raw_cap4` (prod) | **no existe** |
| `stg_cap4_dev` | **existe**, US, created `2026-09-10T21:08:59Z` |
| `int_cap4_dev` | **existe**, US, created `2026-09-10T21:09:00Z` |
| `marts_cap4_dev` | **existe**, US, created `2026-09-10T21:09:00Z` |
| Twins prod `stg_cap4` / `int_cap4` / `marts_cap4` | **no existen** (no se crean acá) |
| SA `vm-pulse-dbt` | **existe** — creada por Nico. Auth OK con `GCP_SA_KEY_DBT` |
| Key JSON dbt | **fuera de git** (`.secrets/` gitignored). Nunca commitear |

Descripción de los tres datasets dbt (API `datasets.get`): *Hito 2 dbt (dev). Created for AE; Meltano does not write here.*

IAM API / Cloud Resource Manager API pueden seguir **apagadas** para la SA Meltano (HTTP 403 al `iam.serviceAccounts.get` con esa identidad). Eso **no** niega que la SA exista: Nico la creó con owner; dbt autentica con `GCP_SA_KEY_DBT`.

## INFORMATION_SCHEMA.SCHEMATA (`region-us`)

```text
schema_name      location  creation_time
int_cap4_dev     US        2026-09-10T21:09:00.251000+00:00
marts_cap4_dev   US        2026-09-10T21:09:00.985000+00:00
raw_cap4_dev     US        2026-09-10T18:11:40.286000+00:00
stg_cap4_dev     US        2026-09-10T21:08:59.464000+00:00
```

`raw_cap4` no aparece (dataset prod todavía no creado).

## ACL / roles verificados (2026-09-10)

ACL de dataset (equivalente BQ: READER = `dataViewer`, WRITER = `dataEditor`). Grant hecho con Meltano SA (**OWNER** de los datasets, los creó). Bindings de `vm-pulse-dbt` **OK**.

| Scope | Rol | Evidencia |
| --- | --- | --- |
| Proyecto | `roles/bigquery.jobUser` | job de metadata `INFORMATION_SCHEMA.SCHEMATA` (region-us) OK |
| `raw_cap4_dev` | READER / `dataViewer` | `list_tables` → `produccion_pozo_mes` (sin scan) |
| `stg_cap4_dev` | WRITER / `dataEditor` | create+drop `_iam_smoke_hito2` (0 filas) |
| `int_cap4_dev` | WRITER / `dataEditor` | create+drop `_iam_smoke_hito2` (0 filas) |
| `marts_cap4_dev` | WRITER / `dataEditor` | create+drop `_iam_smoke_hito2` (0 filas) |
| `raw_cap4` / twins prod | — | datasets no existen; grant cuando DE los cree |

Meltano sigue OWNER de los datasets dbt. No escribe modelos ahí. `--tighten-acl` saca a Meltano **si** Nico quiere least-privilege estricto.

## Default table expiration

`default_table_expiration_ms = 5184000000` (**60 días**) en `raw_cap4_dev` y en los tres datasets dbt (default de proyecto al crear). Si dbt materializa tablas sin override, **caducan a los 60 días**. El provision script avisa; Nico puede pasar `--unset-table-expiration` sobre `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev` si quiere que persistan.

## Secret `GCP_SA_KEY_DBT` (mismo patrón que Meltano, otro secret)

Meltano usa el secret de repo **`GCP_SA_KEY`**. dbt usa **otro** secret: **`GCP_SA_KEY_DBT`**. No reutilizar la key de Meltano (roles distintos; Meltano no debe escribir marts). [materialize-dbt-sa-key.sh](../scripts/materialize-dbt-sa-key.sh) **rechaza** `GCP_SA_KEY` a propósito.

1. Abrí el JSON descargado (el archivo **completo**, de `{` a `}`).
2. GitHub / Cursor → Secrets → `GCP_SA_KEY_DBT`.
3. En runtime:

```bash
export GCP_SA_KEY_DBT='<contenido COMPLETO del .json de vm-pulse-dbt>'
export GOOGLE_APPLICATION_CREDENTIALS="$(bash transform/scripts/materialize-dbt-sa-key.sh)"
```

Si el store solo guarda el PEM: seteá también `GCP_SA_DBT_CLIENT_EMAIL=vm-pulse-dbt@<project-id>.iam.gserviceaccount.com` (o `BIGQUERY_PROJECT`; el script deriva el email documentado). **No** uses `GCP_SA_KEY` ni `GCP_SA_CLIENT_EMAIL` de Meltano.

## Re-verify (sin secretos en git)

```bash
# Con la SA dbt (preferido; confirma auth + datasets)
export GOOGLE_APPLICATION_CREDENTIALS="$(bash transform/scripts/materialize-dbt-sa-key.sh)"
bash transform/scripts/provision_hito2_bq.sh --verify-only
# exit 0 si datasets + SA OK

# Meltano SA alcanza para listar datasets; puede devolver HTTP 403 en IAM API
# (eso no contradice que Nico ya creó vm-pulse-dbt).
```

Queries usadas (sin PII, sin keys):

```sql
SELECT schema_name, location, creation_time
FROM `$BIGQUERY_PROJECT.region-us.INFORMATION_SCHEMA.SCHEMATA`
WHERE schema_name IN (
  'raw_cap4_dev', 'raw_cap4',
  'stg_cap4_dev', 'int_cap4_dev', 'marts_cap4_dev'
)
ORDER BY schema_name;
```

## Fuera de alcance (este doc)

- Crear `raw_cap4` ni twins prod `stg_cap4` / `int_cap4` / `marts_cap4`
- Commitear JSON de SA
- Afirmar `dbt build` / `dbt test` verde sin corrida warehouse
