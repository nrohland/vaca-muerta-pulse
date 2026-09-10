-- Intended physical table AFTER a successful raw load.
-- z3z1ma target-bigquery (pinned SHA) partitions on _sdc_batched_at MONTH, not on
-- the business DATE `periodo`. Clustering fields ARE wired in meltano.yml
-- (empresa, idpozo, cuenca) when the loader creates the table.
--
-- This pin cannot PARTITION BY DATE(periodo). Keep documenting the helper;
-- do not invent a successful periodo partition until the loader supports it.
-- Loader-native layout (pre-created in create_produccion_pozo_mes.sql):
--   PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)
--   CLUSTER BY empresa, idpozo, cuenca
--
-- Verify after an append load (final COUNT must be > 0):
--   SELECT table_name, ddl
--   FROM `vaca-muerta-pulse.raw_cap4_dev.INFORMATION_SCHEMA.TABLES`
--   WHERE table_name = 'produccion_pozo_mes';
-- More queries: verify_layout.sql

CREATE TABLE IF NOT EXISTS `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes_by_periodo`
PARTITION BY DATE(periodo)
CLUSTER BY empresa, idpozo, cuenca
AS
SELECT
  * EXCEPT (
    _sdc_extracted_at,
    _sdc_received_at,
    _sdc_batched_at,
    _sdc_deleted_at,
    _sdc_sequence,
    _sdc_table_version,
    _sdc_sync_started_at
  )
FROM `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes`;
