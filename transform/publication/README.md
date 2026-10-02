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
(cd transform/offline && "$DBT" build --indirect-selection cautious --no-partial-parse --profiles-dir . --select +fct_production_month +fct_entity_growth --quiet --warn-error-options '{"error": ["NoNodesForSelectionCriteria"]}')
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" -m unittest discover -s tests/transform -v
```

El build ejecuta seed sintético, dos modelos, unit tests dbt y checks de calendario/reconciliación/grano/integridad. Solo crea artefactos locales en `transform/offline/target` y logs en el mismo proyecto. Los fixtures no se exportan para publicación ni se confunden con fuente oficial.

## Build primario y export candidato

En `transform/`, instalar paquetes con `dbt deps`, usar perfil BigQuery existente y ejecutar (solo tras autorizar writes cloud):

```sh
"$DBT" build --indirect-selection cautious --select fct_production_month fct_entity_growth --vars '{"approved_period":"2026-07-01","accepted_periods":["2026-06-01","2026-07-01"]}' --quiet --warn-error-options '{"error": ["NoNodesForSelectionCriteria"]}'
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
(cd transform && "$DBT" build --indirect-selection cautious --profiles-dir . --target dev_oauth --select +fct_production_month +fct_entity_growth --vars '{"approved_period":"2026-07-01","accepted_periods":["2026-06-01","2026-07-01"]}' --quiet --warn-error-options '{"error": ["NoNodesForSelectionCriteria"]}')
```

Aquí `+` incluye staging, intermediate y fct_well_month del raw candidato, sin reconstruir completaciones ni usar los marts viejos. La lista de aceptación de ejemplo es parcial: reemplazar por todos los snapshots completos revisados requeridos para historia/YoY. Dev/oauth escribe `stg_cap4_dev_candidate_20261001`, `int_cap4_dev_candidate_20261001` y `marts_cap4_dev_candidate_20261001`. Se preservan los datasets previos. Build/test cloud, reconciliación del raw corregido y aprobación manual siguen pendientes; pasar tests offline verifica fórmulas y aislamiento de nombres, no certifica esos datos.


Los builds de publicación usan `--indirect-selection cautious`: un test con varias dependencias se incluye solo cuando todas están seleccionadas. Evita ejecutar reconciliaciones de marts legacy no construidos en un build acotado. Los gates de publicación permanecen seleccionados junto a sus dos marts y upstream; QA completa debe construir y probar también los marts legacy por separado o con el selector completo autorizado.

## Operadores agrupados de Estrato

`seeds/operator_groups.csv` versiona exclusivamente PCN y PLU → `PLUSPETROL` / Pluspetrol con regla `estrato-operator-groups-v1`, válida desde enero de 2023 (inclusive; extremo final abierto). Es una agrupación constante de presentación del histórico retenido, aprobada en spec 002 y ADR 0004. No reconstruye carteras históricas ni atribuye EXX u otros vendedores al comprador. IDs desconocidos conservan ID y nombre fuente, incluso si el nombre contiene Pluspetrol.

Ambos marts de publicación usan el mismo join explícito de IDs y fechas antes de sumar volúmenes. Después calculan tasas, bases calendario YoY/MoM, porcentajes, ranking y concentración. `fct_well_month`, `fct_company_month` y `dim_company` conservan su semántica legal. `entity_name` muestra Pluspetrol; `source_name` mantiene un nombre legal observado por compatibilidad, y `legal_operator_provenance` contiene el conjunto completo de pares `{idempresa, empresa}` del snapshot del mes. Salidas ausentes y áreas tienen procedencia nula. `operator_group_rule_version` identifica la regla aplicada al mes actual; valores no mapeados quedan nulos.

El export conserva schema_version=1 y los campos previos. Para filas del contrato agrupado añade `operator_grouping` tanto a release como manifest: mapping, significado, versión y hash del seed; valida la procedencia legal del grupo. Los exports previos sin los nuevos campos siguen siendo válidos sin esa metadata. Los marts de operador por área y de mapa/detalle quedan para el siguiente paso; deberán usar esta misma regla en dbt, sin cálculos de frontend.

Regresión offline: dos entidades legales con variaciones individuales 200% y 0% producen variación conjunta 20%, volumen/tasa sumados y ranking/concentración recalculados. Incluye identidad desconocida, EXX, base cero, comparación calendario ausente, procedencia, ambos fluidos y reconciliación existente. `profiles.yml.example` es versionado; copiarlo al perfil local ignorado antes del build:

```sh
cp transform/offline/profiles.yml.example transform/offline/profiles.yml
(cd transform/offline && "$DBT" build --no-partial-parse --profiles-dir . --select +fct_production_month +fct_entity_growth --quiet)
"$PYTHON" -B -m unittest discover -s tests/transform -v
```

El build BigQuery real y revisión independiente pertenecen al responsable de integración; esta fase no escribe en cloud.

Verificación de esta implementación (2026-10-02): el build offline anterior pasó con `/private/tmp/estrato-runtime/bin/dbt`, usando las versiones fijadas arriba: 2 seeds, 2 modelos, 15 data tests y 2 unit tests. Después del build, `/private/tmp/estrato-runtime/bin/python -B -m unittest discover -s tests/transform -v` pasó las 20 pruebas Python. `target/run_results.json` registra exclusivamente estados success/pass. El runtime previo en `work/runtime` quedó bloqueado por archivos iCloud sin contenido local; el runtime temporal permitió verificar el mismo SQL compartido. Estas son comprobaciones locales sobre fixtures sintéticos. El build real BigQuery, la revisión independiente de integración y la aprobación de publicación siguen pendientes; no se ejecutó BigQuery.

## Estrato: actividad mensual y detalles operador × área

`fct_well_activity_month` tiene grano `(fluid, periodo, idpozo)`: conserva todas las filas del snapshot de producción, incluidos volumen cero y geografía ausente. Reutiliza `publication_base`: petróleo bbl, gas millones m³, tasas por días calendario; PCN/PLU agrupados antes de comparar. `legal_operator_id/name`, área, cuenca, sigla, estado y tipo proceden de producción mensual. El join al padrón usa exclusivamente `idpozo`; `catalog_at` es DATETIME sin zona afirmada y nunca sustituye `periodo`. Las coordenadas son del catálogo actual y no reconstruyen posiciones históricas.

`fct_operator_area_month` prepara series, MoM/YoY calendario exacto, diferencias, porcentajes, cuota dentro del operador y conteos/cobertura geográfica en SQL. Incluye entidades ausentes del mes actual con cero únicamente dentro de snapshots aceptados íntegros; comparadores de meses faltantes y porcentajes con base cero siguen nulos. `fct_map_coverage_month` cuantifica catálogo ausente, coordenada inválida, pozos positivos ubicados/no ubicados y áreas sin polígono. Cuenca NEUQUINA se comprueba en el gate, sin eliminar filas fuera de alcance silenciosamente ni afirmar validación espacial.

Fuentes normalizadas: `raw_geography.capitulo_iv_pozos` y `concessions_geography`, dataset por `DBT_RAW_DATASET` (override `geo_raw_dataset` opcional). Las concesiones se unen por código fuente `area_id`. AVI permanece en cuarentena y no recibe polígono elegido/inventado. La revisión de topología de polígonos usados es una comprobación externa obligatoria del candidato oficial; este paso local no afirma haberla ejecutado.

Para exportar el mapa, agregar **todos** los argumentos siguientes al comando de release existente:

```bash
--activity /ruta/fct_well_activity_month.json \
--operator-areas /ruta/fct_operator_area_month.json \
--map-coverage /ruta/fct_map_coverage_month.json \
--geo-manifest /ruta/geo-candidate/manifest.json \
--areas-geometry /ruta/geo-candidate/areas.normalized.ndjson
```

Los tres archivos de marts son arrays JSON exportados de dbt; las áreas deben conservar exactamente los bytes NDJSON del manifiesto. Inputs parciales fallan. Requiere éxito de los tres modelos y PASS de `assert_map_grain`, `assert_map_integrity`, `assert_map_reconciliation`; no reemplaza aceptación oficial ni aprobación de promoción. Python solo serializa y valida valores preparados/reconciliación. El comando sin argumentos geográficos conserva el contrato legado.

`release.json.map.index` contiene ruta, SHA256 y tamaño del índice. El hash principal de release incluye esa referencia: el consumidor debe verificar primero el SHA256 del release esperado, después SHA del índice, y finalmente SHA de cada archivo lazy. No confiar en un índice mutable independiente. El índice conserva cobertura SQL por mes/fluido, procedencia y hashes de GeoJSON mensual/detalle operador-área y polígonos usados. Cada GeoJSON contiene todas las filas de actividad, con `geometry: null` para tabla alternativa; `positive_production` controla los puntos productivos. No consultar BQ por visita, no calcular tasas/crecimientos/cobertura en el navegador.

Verificación local ejecutada 2026-10-02, fixture sintética compartiendo SQL de negocio:

```bash
# cwd transform/offline; copiar profiles.yml.example a profiles.yml local si falta
/private/tmp/estrato-runtime/bin/dbt build --no-partial-parse --profiles-dir . --quiet
# cwd raíz
/private/tmp/estrato-runtime/bin/python -B -m unittest discover -s tests/transform -v
```

Resultado: dbt exit 0, 5 modelos, 4 seeds, 19 data tests y 2 unit tests exitosos; Python 28 tests OK. Casos cubren coordenadas ausentes/inválidas preservadas, producción vs catálogo actual, agrupación legal PCN/PLU, base cero, fechas calendario, ambos fluidos, reconciliación total y por entidad, integridad de hashes, inputs incompletos, alteraciones y fanout mediante duplicación deliberada del catálogo contra el SQL compilado real. Build/reconciliación oficial BigQuery, export real y revisión independiente quedan a cargo del coordinador; publicación/web pertenecen a fases posteriores.

Los GeoJSON mensuales se guardan como `.geojson.gz` con gzip determinista (`mtime=0`). SHA256 y tamaño del descriptor corresponden a bytes comprimidos. El consumidor verifica hash antes de descomprimir con `DecompressionStream('gzip')` y parsear JSON; la compresión es técnica y no altera filas ni métricas. Tests verifican roundtrip y determinismo entre dos exports idénticos.


Reparación tras revisión independiente (2026-10-02): se agrega el gate obligatorio `assert_map_metrics`. Recomputa desde actividad todos los conteos y ratios globales y por operador-área, volumen/tasa actual, comparadores calendario, diferencias, porcentajes y cuota. FULL JOIN protege filas faltantes/adicionales. El exportador valida esas mismas identidades numéricas sin sustituir valores publicados: la aritmética en Python es comprobación, las métricas permanecen producidas en dbt. Rechaza nulls inconsistentes, no finitos, conteos alterados y fechas/IDs de catálogo diferentes del manifiesto. Los índices hasheados incorporan metadata compacta de recursos (id/url/last_modified), licencias conocidas o null honesto, cuarentena y semántica de fechas; no modifica el manifiesto fuente ni inventa licencia del padrón.

Verificación fresca tras reparación: dbt build completo exit 0 con 5 modelos, 4 seeds, 20 data tests y 2 unit tests; unittest discovery 31 tests OK. El test de SQL copia la DuckDB sintética temporalmente y altera cada uno de los diez conteos en ambos marts, además de ratios, porcentajes y share: el gate compilado real detecta cada mutación. Tests del exportador alteran todos esos conteos, ratios, porcentajes/share, identidad de recurso y fecha de catálogo; todos se rechazan. Controles cloud y revisión del coordinador siguen pendientes.
