# ADR 0004: Estrato, candidato inmutable y mapa público

Estado: aceptado para implementación. Fecha: 2026-10-02.

## Contexto

Nicolás eligió la propuesta clara Estrato, pestañas, ranking de operadores en barras y mapa VM/Neuquina con alternativa gratuita. El histórico oficial retenido consta de 3.511.366 registros; carga Parquet de 32MB a nuevo candidato y dbt real se verificaron (10 modelos y 67 pruebas). El cron anterior borra raw dev antes de cargar, no conserva snapshot y fija 2025.

## Decisiones

Se conserva el extractor Singer del repo y Meltano como camino soportado. Para releases revisadas, el camino principal se basa en el mismo extractor validado → snapshots NDJSON retenidos temporalmente → Parquet técnico → BigQuery nuevo candidato WRITE_EMPTY → dbt → export versionado → Next estático. Se justifica el batch por identidad del snapshot realmente validado, repetibilidad sin reconsultar datos cambiantes, una carga de 32MB y preservación del raw anterior. No reemplaza BQ ni dbt, no agrega un segundo motor de métricas. Desactivar cron destructivo; tres ciclos manuales. Parquet normaliza tipos/columnas técnicas, nunca calcula métricas de negocio.

MapLibre renderiza capas geográficas oficiales y OpenFreeMap proporciona fondo Positron. Proveedor independiente de datos de producción; atribución y fecha de catálogo visibles. Sin API key ni costo fijo de ese servicio a la fecha; no SLA. Error de fondo conserva tabla y datos. No cargar capas demo como información energética real.

Mapping PCN/PLU a grupo Pluspetrol antes de agregación; demás IDs sin cambio. Ranking/concentración de grupo empresarial se distinguen del operador legal declarado. Assets de logos oficiales con procedencia, copia local y fallback sin dependencia externa por visita.

## Alternativas y límites

Meltano live append seguido de borrar/reemitir: conserva stack, pero no reproduce exactamente el snapshot revisado y puede destruir el estado previo. Se mantiene para uso manual documentado, no promoción pública. Mapbox/MapTiler: opciones válidas con cuotas/condiciones y eventual facturación; no necesarias para este alcance.

Crear PRs apilados y candidatos no equivale a aprobar/publicar. Solo Nicolás mergea y aprueba promociones. Credenciales dbt separadas, sin fallback a la SA de extracción. Activación de Pages/secretos queda documentada hasta aprobación concreta.
