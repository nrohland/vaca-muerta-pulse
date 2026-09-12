-- Pre-create Adjunto IV landing so target-bigquery can APPEND.
--
-- Cluster on columns that exist on this grain. `empresa` is NOT here
-- (production uses CLUSTER BY empresa, idpozo, cuenca). Default loader
-- clustering would fail CREATE; job `cap4-fracturas` uses
-- target-bigquery--fracturas with this cluster list.
--
-- PARTITION is MONTH(_sdc_batched_at), same loader-native layout as
-- produccion_pozo_mes. Do NOT PARTITION BY fecha_inicio_fractura: the
-- sandbox 60-day window would drop 2006–2025 on write.
--
-- Idempotent: IF NOT EXISTS. Never CREATE OR REPLACE (Bug 1).
-- Reload: DROP+CREATE (--recreate) in sandbox, or TRUNCATE with billing.
--
-- Replace raw_cap4_dev → raw_cap4 in prod.

CREATE TABLE IF NOT EXISTS `vaca-muerta-pulse.raw_cap4_dev.fracturas_adjunto_iv`
(
  _sdc_batched_at TIMESTAMP,
  idpozo INT64,
  cuenca STRING,
  empresa_informante STRING,
  id_base_fractura_adjiv INT64,
  sigla STRING,
  areapermisoconcesion STRING,
  yacimiento STRING,
  formacion_productiva STRING,
  tipo_reservorio STRING,
  subtipo_reservorio STRING,
  longitud_rama_horizontal_m FLOAT64,
  cantidad_fracturas INT64,
  tipo_terminacion STRING,
  arena_bombeada_nacional_tn FLOAT64,
  arena_bombeada_importada_tn FLOAT64,
  agua_inyectada_m3 FLOAT64,
  co2_inyectado_m3 FLOAT64,
  presion_maxima_psi FLOAT64,
  potencia_equipos_fractura_hp FLOAT64,
  fecha_inicio_fractura TIMESTAMP,
  fecha_fin_fractura TIMESTAMP,
  fecha_data TIMESTAMP,
  anio_if INT64,
  mes_if INT64,
  anio_ff INT64,
  mes_ff INT64,
  anio_carga INT64,
  mes_carga INT64,
  mes INT64,
  anio INT64,
  periodo DATE,
  _sdc_extracted_at TIMESTAMP,
  _sdc_received_at TIMESTAMP,
  _sdc_deleted_at TIMESTAMP,
  _sdc_sequence INT64,
  _sdc_table_version INT64,
  _sdc_sync_started_at TIMESTAMP
)
PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)
CLUSTER BY idpozo, cuenca, empresa_informante;
