# Candidato anual de extracción

El endpoint oficial usa una versión de CKAN que no admite `total_estimation_threshold` (responde HTTP 409). Se solicita `include_total=True`, se verifica el conteo antes y después, y se rechaza cualquier respuesta que declare `total_was_estimated`. La ayuda live de `datastore_search` describe `total` como cantidad de registros coincidentes. Este comportamiento se verificó el 1 de octubre de 2026 con el recurso anual 2026: 561.000 filas. No se reintentan automáticamente errores de validación con parámetros alternativos.

La fuente tampoco expone `_id`, incluso si se solicita explícitamente en `fields`. Por eso se ordena por la clave declarada del stream (`idpozo, anio, mes` para producción), cuya unicidad se exige, y se verifica orden estrictamente creciente entre páginas. La consulta live de 2026 devolvió siete meses consecutivos del pozo 212 seguidos del pozo 213. Este ajuste sustituye la propuesta de orden por `_id` del plan inicial basándose en la API real; conserva determinismo y falla ante claves repetidas/desordenadas.

La extracción conserva producción raw amplia. No calcula tasas, conversiones, rankings ni recorta la fuente a Vaca Muerta. El grano revisado es `idpozo, anio, mes`; no equivale al ID técnico `_id` de CKAN. Padrón y Adjunto IV conservan sus streams y sus claves propias.

## Ejecución local reproducible

Desde la raíz del repo, con Python 3.10+ y dependencias del tap instaladas en un entorno externo al repo (`singer-sdk>=0.46,<0.55`, `requests>=2.31,<3`, `google-cloud-bigquery>=3,<4`; PyYAML y jsonschema vienen con Singer):

```bash
python -m pip install "singer-sdk>=0.46,<0.55" "requests>=2.31,<3" "google-cloud-bigquery>=3,<4"
python -m unittest discover -s extraction/tests -v
python extraction/scripts/prepare_history_candidate.py --years 2023 2024 2025 2026 --output /tmp/cap4-candidate-20261001
# Opcional: misma raw completa + archivo separado para QA del recorte VM.
python extraction/scripts/prepare_history_candidate.py --years 2025 --qa-vm --output /tmp/cap4-candidate-qa-20261001
```

El script elige el primer recurso anual revisado en `resources/cap4.yml`, sin clones “con identificador” ni DDJJ alternativas. Descarga DataStore oficial, no scrapea HTML. No ejecuta cargas ni queries de GCP. No acepta un directorio existente. Escribe en temporal y publica el directorio completo solamente si pasan los controles; elimina parciales ante fallos. Guardar candidatos grandes fuera del repo.

## Contrato y controles

`plugins/tap-ckan-datastore/tap_ckan_datastore/production_contract.json` fija los nombres y tipos CKAN a partir del catálogo revisado de 2025. Cambios de campos o tipos requieren revisión explícita; no se convierten campos desconocidos silenciosamente. Singer declara propiedades cerradas, todos los campos de producción requeridos y tipos normalizados. Cada fila se valida contra ese esquema también en el iterador usado por el candidato: campos opcionales en valor aceptan null, pero columnas ausentes fallan. Volúmenes deben ser numéricos finitos; cadenas numéricas se normalizan, valores inválidos y booleanos fallan. Timestamps aceptan ISO con zona o sin zona, como PostgreSQL CKAN; no se inventa una zona horaria. `idempresa` y los IDs de área siguen siendo texto. IDs numéricos/años/meses requieren valores enteros finitos; no se redondean fracciones ni se aceptan booleanos. La producción exige idpozo positivo, año 1..9999 y mes 1..12; año debe coincidir con el recurso solicitado en el candidato.

Requests ordenan por la clave primaria declarada, piden total exacto y siguen páginas cortas mientras falta total. Fallan ante página vacía prematura, sobrerrespuesta, claves no crecientes, duplicados de grano, total estimado, cambio de esquema o total. Una consulta final repite conteo/esquema. Reemitir con `max_records` está prohibido cuando `reemit=true` (Meltano `TAP_CKAN_DATASTORE_REEMIT=true`) o `REEMIT=true`; cualquier wrapper de reemisión debe pasar esa marca antes de borrar/cargar datos. Un smoke limitado sigue siendo un smoke, nunca un candidato anual.

El manifiesto conserva metadatos oficiales antes/después, esquema, filas por período, meses calendario ausentes y SHA-256 de NDJSON normalizado. `duplicate_grain=0` sólo se registra tras extracción completa sin duplicados. `qa_vm_rows` corresponde al archivo opcional separado, nunca al conteo raw. El checksum no es el hash de bytes del CSV original. Las claves vistas requieren memoria proporcional al año. El año en curso puede tener meses ausentes esperados: la revisión decide cobertura, el código no los rellena con cero.

CKAN es mutable y no ofrece snapshot transaccional. Conteo estable, orden y metadata no excluyen una modificación con mismo conteo durante paging; no prometer idempotencia histórica anterior a las capturas retenidas. Hashes comparables y conservación de candidatos permiten detectar cambios entre capturas. Un candidato validado localmente tiene `promotion_approved=false`.

## Carga a tabla nueva y aceptación pendiente

Este paso no ejecutó descargas anuales completas ni cargas de warehouse. Antes de cargar, verificar manifest, cobertura y checksums nuevamente. Crear un dataset o tabla **nueva** identificada por release, con retención y permisos revisados; no apuntar el target a `raw_cap4` o `raw_cap4_dev` existentes. Cargar los NDJSON completos conservados mediante batch load con esquema explícito derivado del contrato, `periodo` DATE y nombres originales. Usar `WRITE_EMPTY`, nunca autodetect ni `WRITE_TRUNCATE`. No cargar `*.qa-vm.ndjson` a tablas raw de producción. La extracción local no contiene `_sdc_batched_at`: un batch load puede usar partición por `periodo`, documentada y verificada independientemente del layout del loader Singer.

Para un candidato nuevo mediante Singer, configurar un dataset nuevo en target-bigquery, `overwrite=false`, y precrear el layout propio del loader MONTH(`_sdc_batched_at`) + cluster `empresa,idpozo,cuenca`; cada intento fallido recibe otro candidato, nunca append sobre un parcial. El comando read-only siguiente sólo compara tablas Singer con ese layout:

```bash
python extraction/scripts/compare_source_count.py --project PROJECT --dataset NEW_CANDIDATE_DATASET --year 2025 --resource-id d774b5d7-0756-48fe-88f2-8729b57b22da
```

El comparador exige recurso/año del catálogo revisado, filtra `anio=@year`, limita el COUNT a 1 GiB y sale 1 ante delta, layout incorrecto o staging residual. COUNT sigue pudiendo leer múltiples particiones con `_sdc_batched_at`; el límite falla cerrado y no se sube automáticamente.

Antes de promoción: reconciliar conteos por año/mes con el manifiesto retenido (la fuente live puede cambiar), verificar schema/layout, claves únicas, fechas válidas, todas las filas del año y ausencia de cargas parciales; ejecutar tests downstream y revisar diferencias respecto de la última captura. Contar filas nunca sustituye esos controles. Cualquier fallo mantiene la última tabla/release aceptada. Primeros tres ciclos requieren revisión manual y sólo Nicolás autoriza la promoción. No se incluye SQL de reemplazo ni se llama al procedimiento histórico de DELETE/TRUNCATE.
