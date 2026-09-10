-- Pre-create the landing table with the physical layout the loader CAN keep
-- (MONTH on _sdc_batched_at + CLUSTER empresa, idpozo, cuenca).
--
-- Why this exists (Bug 1, z3z1ma @090dad06):
--   overwrite:true writes a staging table then
--     CREATE OR REPLACE TABLE final AS SELECT * FROM staging
--   BigQuery rejects that when `final` is partitioned:
--     400 Cannot replace a table with a different partitioning spec
--     (new=none, existing=month+_sdc_batched_at+cluster)
--   Rows stay in produccion_pozo_mes__* and the final table stays at 0.
--
-- Product intent is still PARTITION BY DATE(periodo) — see intended_partition.sql.
-- This pin cannot partition on `periodo`; do not claim it does.
--
-- Idempotent: IF NOT EXISTS. The denormalized loader may ADD columns later.
-- Never CREATE OR REPLACE this table (that is the bug).
-- Reload a year with reemit_year.sql (DELETE WHERE anio=…) then append.
-- Dev full refresh without dropping layout: TRUNCATE TABLE (keeps partition+cluster).
--
-- Replace raw_cap4_dev → raw_cap4 in prod.

CREATE TABLE IF NOT EXISTS `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes`
(
  -- Partition column (loader-native). Must exist before the first append.
  _sdc_batched_at TIMESTAMP,
  -- Cluster columns (order matches meltano.yml).
  empresa STRING,
  idpozo INT64,
  cuenca STRING,
  -- Tap columns (Capítulo IV pozo-mes). Types follow the Singer schema
  -- (INTEGER_FIELDS → INT64, jsonschema number → FLOAT64, date → DATE).
  idempresa STRING,
  anio INT64,
  mes INT64,
  prod_pet FLOAT64,
  prod_gas FLOAT64,
  prod_agua FLOAT64,
  iny_agua FLOAT64,
  iny_gas FLOAT64,
  iny_co2 FLOAT64,
  iny_otro FLOAT64,
  tef FLOAT64,
  vida_util FLOAT64,
  tipoextraccion STRING,
  tipoestado STRING,
  tipopozo STRING,
  observaciones STRING,
  fechaingreso TIMESTAMP,
  rectificado STRING,
  habilitado STRING,
  idusuario INT64,
  sigla STRING,
  formprod STRING,
  profundidad FLOAT64,
  formacion STRING,
  idareapermisoconcesion STRING,
  areapermisoconcesion STRING,
  idareayacimiento STRING,
  areayacimiento STRING,
  provincia STRING,
  tipo_de_recurso STRING,
  proyecto STRING,
  clasificacion STRING,
  subclasificacion STRING,
  sub_tipo_recurso STRING,
  fecha_data TIMESTAMP,
  periodo DATE,
  -- Remaining Singer metadata the target attaches.
  _sdc_extracted_at TIMESTAMP,
  _sdc_received_at TIMESTAMP,
  _sdc_deleted_at TIMESTAMP,
  _sdc_sequence INT64,
  _sdc_table_version INT64,
  _sdc_sync_started_at TIMESTAMP
)
PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)
CLUSTER BY empresa, idpozo, cuenca;
