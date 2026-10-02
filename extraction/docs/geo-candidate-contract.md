# Candidato geográfico oficial

Paso técnico local del ADR 0004. No publica un mapa ni realiza joins de producción.

`prepare_geo_candidate.py` reutiliza `CapituloIvPozosStream` y su paginación Singer ordenada por `idpozo`, aplicando el contrato revisado de 26 campos en `resources/geo-contract.json`. Lee el padrón completo nacional, sin filtro VM. Exige total exacto, esquema estable, IDs positivos integrales únicos, orden creciente y páginas completas. Repite toda la extracción y exige igualdad de hashes, perfiles y metadata antes de conservar el directorio. Un fallo elimina el directorio temporal; un destino existente nunca se sobrescribe.

```bash
python extraction/scripts/prepare_geo_candidate.py \
  --output /ruta/nueva/geo-candidate \
  --areas-zip /ruta/a/official-concessions.zip \
  --areas-metadata /ruta/a/areas-metadata.json \
  --exclude-area-code AVI
python -m unittest discover -s tests/extraction -v
```

Requiere las dependencias del tap Singer del repo, `requests` y `pyshp` (probado 2.3.1). El paquete metadata de áreas es el payload `package_show` oficial. El ZIP se suministra localmente; el script no afirma haber verificado su frescura contra red. Sin los argumentos de áreas genera solo pozos. Consultas `resource_show` y `datastore_search` son públicas y de lectura, sin credenciales ni escritura cloud.

El entry point geográfico exige solamente `pozos_resource_id` mediante un override local del schema de configuración Singer. No necesita ni inventa un recurso de producción; el contrato del tap general permanece intacto. Solicita páginas de 2.000 filas: el intento con 32.000 sufrió timeout HTTP al seguir redirects. El tamaño menor conserva las mismas validaciones de esquema, orden, total y dos pasadas; no introduce fallback silencioso ni límite de filas.

Salida: `wells.raw.ndjson` conserva todos los campos fuente y `wells.normalized.ndjson` conserva esos mismos campos más `longitude`, `latitude`, `coordinate_valid`, `coordinate_issue`, `geometry_status`, `coordinate_crs`, `catalog_at` y `source_resource_id`. `idpozo` es entero; fechas ISO mantienen zona cuando existe y no inventan zona para timestamps sin offset. `catalog_at` es `last_modified` del padrón, distinto del período de producción. `idpozo` identifica un registro por formación; `sigla` identifica boca y puede repetirse. Una producción por `idpozo` solo admite geografía muchos-a-uno. No unir por boca, nombres ni coordenadas, ni usar atributos actuales para reconstruir producción histórica.

GeoJSON Point usa [longitud, latitud]; EWKB debe ser Point 2D SRID 4326. Ambas variantes deben coincidir si están presentes. Coordenadas ausentes, malformadas, no finitas, fuera de rangos, cero o discordantes dejan la entidad con ambos ejes null y un motivo cuantificado. No se intercambian ejes ni se adivinan posiciones. Los conteos VM/Neuquina son perfil del catálogo actual, no filtro de producción ni test de pertenencia espacial. Falta polígono de cuenca para ese control.

`areas.normalized.ndjson` usa `area_id` = `CODIGO_DE_` = `codigo_de_sesco`, geometría Polygon/MultiPolygon del SHP, atributos fuente salvo `GEOJSON` DBF truncado, CRS y estado. Exige esquema DBF y PRJ WGS84 exactos revisados, rings cerrados, rangos y códigos completos. Los códigos duplicados fallan por defecto. La exclusión explícita debe coincidir exactamente con el conjunto de duplicados observado; conserva TODAS sus features en `areas.quarantined.ndjson`, omite sus polígonos aceptados y registra conteos/hash en manifiesto. El caso auditado AVI contiene dos versiones diferentes y exige cuarentena explícita; no se disuelve, selecciona o combina arbitrariamente. `areas.source.zip` preserva originales.

`manifest.json` contiene hashes SHA256 de filas canónicas fuente/normalizadas, contrato, metadata, conteos, gaps, dos pasadas estables y aprobación falsa. Los hashes no representan bytes del CSV fuente. Dos pasadas iguales reducen riesgo de mutación pero no son transacción del servidor. CSV y SHP de concesiones tienen fechas distintas; su código nacional, cobertura de producción y versión requieren revisión independiente antes de join. La validez topológica completa de polígonos y la pertenencia espacial a cuenca quedan pendientes. Null geográfico nunca equivale a entidad ausente.

Evidencia revisada 2026-10-02: API suministrada por coordinador, 85.611 filas/IDs y 78.352 bocas, cinco puntos GeoJSON/EWKB concordantes, padrón `last_modified` 2026-07-08. SHP 297 features/296 códigos y duplicado AVI. Estos conteos documentan la auditoría, no se hardcodean como aceptación de futuras versiones. La metadata oficial del package de pozos (`../geo-audit/production-metadata.json`, respecto del worktree) declara `license_id` y `license_title` CC-BY-4.0; áreas también declara CC-BY-4.0. El candidato conserva pendiente la revisión de licencia antes de promoción porque su manifiesto solo incorpora `resource_show` de pozos, sin metadata de package. Ningún resultado offline demuestra cobertura live ni aprobación pública.

## Verificación local de implementación

2026-10-02: `/private/tmp/estrato-runtime/bin/python -B -m unittest discover -s tests/extraction -v` ejecutado desde el worktree: 12 tests, OK. CLI `--help` pasó con el mismo runtime. Casos cubren tipos/IDs, conservación de origen, puntos inválidos/ausentes/conflictivos, bocas repetidas, IDs duplicados, dos pasadas distintas, metadata cambiante, atomicidad/no sobrescritura, cuarentena exacta y rechazo de exclusiones que no son duplicados. El nuevo test inicializa el SDK Singer real y verifica que el entry point admite solamente el recurso de pozos y page size 2.000, mockeando discovery/iterator/red; no es prueba live de cobertura.

Regresión del contrato de extracción existente: `/private/tmp/estrato-runtime/bin/python -B -m unittest discover -s extraction/tests -v`, 17 tests, OK en 24,253 segundos. Incluye paginación, conteo exacto, orden, tipos, fallo parcial y preservación del candidato previo mediante mocks; no ejecutó cargas BigQuery.

Probe local independiente del ZIP real suministrado: `write_areas` sin exclusiones falla por códigos duplicados; con `['AVI']` reporta 297 features, 296 códigos, 295 áreas aceptadas y 2 features AVI en cuarentena; 297 geometrías superan validación estructural/rangos. No es test topológico ni prueba de contemporaneidad del archivo.

## Extracción live y brechas observadas

El coordinador completó la CLI real el 2026-10-02 con el runtime temporal, tras resolver el bloqueo de lectura del runtime anterior. Comando ejecutado desde el directorio que contiene `work/`:

```bash
/private/tmp/estrato-runtime/bin/python \
  work/estrato-geo/extraction/scripts/prepare_geo_candidate.py \
  --output work/geo-candidate-20261002 \
  --areas-zip work/geo-audit/official-concessions.zip \
  --areas-metadata work/geo-audit/areas-metadata.json \
  --exclude-area-code AVI
```

`work/geo-candidate-20261002/manifest.json` confirma 85.611 filas e IDs únicos, 78.352 bocas, cero IDs duplicados y dos pasadas completas iguales. Las 85.611 geometrías de pozo superaron la validación de coordenadas, incluidas 3.547 filas cuyo catálogo actual declara VM/Neuquina. Hash normalizado de pozos: `dee30dbf3635d2ec5f906c2026c751cc94858fd3d76d79074b90a48a3f9061cb`. El SHP produjo 295 áreas aceptadas y 2 features AVI en cuarentena de 297 originales. El manifiesto mantiene `promotion_approved: false`.

Auditoría técnica independiente del coordinador en `outputs/validacion-cobertura-geografica.json`: 3.372 IDs VM en el histórico, de los cuales 78 no están en el padrón actual. En julio 2026 hay 3.358 IDs VM y los mismos 78 carecen de coordenadas por ausencia de entidad en el padrón; no son puntos presentes con geometría inválida. De 87 códigos de área históricos, 18 no tienen polígono fuente. No se imputa ubicación ni se infiere propiedad, vigencia histórica o pertenencia espacial a cuenca. Esta auditoría cuantifica cobertura de claves; no calcula métricas de negocio ni aprueba un mapa público. Revisión topológica completa y control espacial con polígono oficial de cuenca siguen pendientes.
