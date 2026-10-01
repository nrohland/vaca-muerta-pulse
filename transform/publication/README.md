# Marts de publicación

BigQuery es el warehouse primario. DuckDB verifica exclusivamente estos modelos con fixtures sintéticos, sin lectura cloud ni datos publicables. El código SQL de ambos caminos vive en `macros/publication.sql`; no hay segundo motor de métricas en Python.

Granos y nombres de campos: `contract.json`. El total tiene `fluid × periodo`; entidades `fluid × dimension × entity_id × periodo`. Petróleo volumen bbl, tasa bbl/d; gas volumen millones m³, tasa millones m³/d. Conversiones, días calendario, deltas y porcentajes se calculan en dbt. Porcentaje escala 0–100; base cero conserva delta y deja porcentaje nulo. Comparadores unen fechas exactas. Ausencia de mes deja todos los comparadores nulos; no se usa lag(12).

## Aceptación explícita

`approved_period` es el corte aprobado y `accepted_periods` enumera cada snapshot mensual completo autorizado. Nunca se infiere completitud de max(raw), cantidad de filas, fecha de carga ni publicación del recurso. EDA/revisión externa debe verificar el recorte y cobertura de esos snapshots antes de suministrar variables. No aceptar un mes ausente. Ambas dimensiones usan la unión de entidades presentes en el mes actual y comparadores YoY/MoM. Ausencia de entidad implica cero únicamente dentro de estos snapshots completos; `is_absent_current` conserva la regla. Entradas y salidas reconcilian deltas firmados con el total. `coverage` es proporción de volúmenes válidos entre filas reportadas, no prueba de que la fuente esté completa. `is_complete` expresa aprobación del snapshot, no una inferencia estadística.

Latest name se elige determinísticamente en el último mes aceptado; `name_periodo` y `source_name` conservan trazabilidad. Tests permiten renombres entre meses y rechazan nombres contradictorios para un ID en el mismo mes. Operador declarado por mes: no reconstruye cartera constante. Los marts anteriores permanecen disponibles; dimensiones previas ahora exponen el nombre más reciente, fecha de nombre y cantidad de nombres históricos.

## Verificación local reproducible

Un checkout nuevo requiere Python 3.12 y un runtime externo con `dbt-core==1.12.5`, `dbt-duckdb==1.11.0` (instala DuckDB) y Jinja2 (dependencia de dbt). No crear .venv en este proyecto. Si todavía no existe un runtime, instalar fuera del repo, con networking autorizado:

```sh
python3.12 -m venv /absolute/path/outside/repo/dbt-publication
/absolute/path/outside/repo/dbt-publication/bin/python -m pip install 'dbt-core==1.12.5' 'dbt-duckdb==1.11.0'
export PYTHON=/absolute/path/outside/repo/dbt-publication/bin/python
export DBT=/absolute/path/outside/repo/dbt-publication/bin/dbt
```

Con un runtime existente, exportar `DBT`/`PYTHON` como sus paths absolutos. Desde la raíz del repo copiar la plantilla versionada al perfil local ignorado antes del build; no se necesita `dbt deps` para el proyecto offline:

```sh
cp transform/offline/profiles.yml.example transform/offline/profiles.yml
(cd transform/offline && "$DBT" build --no-partial-parse --profiles-dir . --select +fct_production_month +fct_entity_growth --quiet --warn-error-options '{"error": ["NoNodesForSelectionCriteria"]}')
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" -m unittest discover -s tests/transform -v
```

El build ejecuta seed sintético, dos modelos, unit tests dbt y checks de calendario/reconciliación/grano/integridad. Solo crea artefactos locales en `transform/offline/target` y logs en el mismo proyecto. Los fixtures no se exportan para publicación ni se confunden con fuente oficial.

## Build primario y export candidato

En `transform/`, instalar paquetes con `dbt deps`, usar perfil BigQuery existente y ejecutar (solo tras autorizar writes cloud):

```sh
"$DBT" build --select fct_production_month fct_entity_growth --vars '{"approved_period":"2026-07-01","accepted_periods":["2026-06-01","2026-07-01"]}' --quiet --warn-error-options '{"error": ["NoNodesForSelectionCriteria"]}'
```

La lista aquí es ilustrativa: para YoY/series incluir todos los snapshots históricos aceptados. Estos modelos consumen `fct_well_month` ya construido; el selector no reconstruye extracción/completaciones. Los checks compartidos incluyen todos los volúmenes, tasas, comparadores y deltas. Unit tests corren offline contra el mismo SQL. BigQuery execution queda pendiente de verificación externa; pasar offline no demuestra warehouse ni publicación end-to-end.

Exportar cada tabla como JSON array con DATE/TIMESTAMP ISO y preservar `target/run_results.json`. Preparar manifiesto de fuente conforme `contract.json`, con recursos oficiales, hash o razón explícita de hash desconocido, aceptación y commit. `source_loaded_at` es carga raw, no publishdate del recurso. Diferenciar fecha de datos, carga, aceptación y generación de candidato.

```sh
"$PYTHON" transform/publication/export_release.py --production /path/production.json --entities /path/entities.json --source-manifest /path/source.json --dbt-run-results /path/run_results.json --output-dir /path/candidates
```

El export valida completitud declarada, granos, unidades, valores finitos, fluidos/meses, checks dbt y reconciliación agregada con tolerancia 1e-9 relativa/1e-6 absoluta. Hashes SHA256 de inputs y payload, versión por mes/hash, escritura sin reemplazo. No convierte ni calcula métricas. Nunca aprueba una release ni activa publicación. Requiere revisión manual independiente y evidencia de origen oficial; `data_kind=synthetic_test` se rechaza. La metadata de procedencia no sustituye esa revisión.

Concentración se calcula en dbt por fluido/mes/dimensión: cuota top 5 de cada snapshot, cuota top 5 del mes calendario YoY y diferencia en puntos porcentuales. No conserva un conjunto fijo de empresas entre años. `volume_rank` desempata por ID. `yoy_contribution_selected` marca hasta cinco positivos y cinco negativos por delta de tasa, con desempate por ID; `yoy_rest_rate_delta` contiene la suma firmada de todos los omitidos, repetida para la dimensión/mes. La UI toma una copia del resto, sin sumarlo ni recalcularlo. El export valida seleccionados + resto contra total. Mes sin base deja resto nulo y ninguna entidad seleccionada. Volumen total cero deja cuota top5 nula.


## Capas aisladas de candidato

Una fuente histórica corregida exige reconstruir todas las capas del candidato. `DBT_RAW_DATASET` selecciona el raw nuevo ya cargado y reconciliado por el responsable de extracción. `DBT_CANDIDATE_SUFFIX` añade `_suffix` a los datasets stg/int/marts; solo permite `[a-zA-Z0-9_]`. Sin suffix se conservan exactamente los nombres previos. No modifica el raw ni el fallback del perfil: configurar `DBT_BQ_DATASET` explícitamente para que ese fallback también sea del candidato. Un suffix nuevo evita sobrescribir capas anteriores; no reusar uno aprobado. La macro no crea recursos ni otorga permisos.

Para el camino primario instalar `dbt-bigquery==1.12.1` en el runtime externo, copiar `transform/profiles.yml.example` al perfil local ignorado y resolver `dbt deps` con networking autorizado. `dev_oauth` usa Application Default Credentials ya configuradas fuera del repo; no copiar credenciales a estos archivos. El responsable debe confirmar los permisos para datasets nuevos y autorizar la ejecución cloud. Ejemplo desde la raíz (no ejecutado por esta reparación):

```sh
"$PYTHON" -m pip install 'dbt-bigquery==1.12.1'
cp transform/profiles.yml.example transform/profiles.yml
export DBT_RAW_DATASET=raw_cap4_candidate_20261001
export DBT_CANDIDATE_SUFFIX=candidate_20261001
export DBT_BQ_DATASET=stg_cap4_dev_candidate_20261001
(cd transform && "$DBT" deps --quiet)
(cd transform && "$DBT" build --profiles-dir . --target dev_oauth --select +fct_production_month +fct_entity_growth --vars '{"approved_period":"2026-07-01","accepted_periods":["2026-06-01","2026-07-01"]}' --quiet --warn-error-options '{"error": ["NoNodesForSelectionCriteria"]}')
```

Aquí `+` incluye staging, intermediate y fct_well_month del raw candidato, sin reconstruir completaciones ni usar los marts viejos. La lista de aceptación de ejemplo es parcial: reemplazar por todos los snapshots completos revisados requeridos para historia/YoY. Dev/oauth escribe `stg_cap4_dev_candidate_20261001`, `int_cap4_dev_candidate_20261001` y `marts_cap4_dev_candidate_20261001`. Se preservan los datasets previos. Build/test cloud, reconciliación del raw corregido y aprobación manual siguen pendientes; pasar tests offline verifica fórmulas y aislamiento de nombres, no certifica esos datos.
