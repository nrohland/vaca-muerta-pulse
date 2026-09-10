-- Intended physical table AFTER a successful raw load.
-- z3z1ma target-bigquery (pinned SHA) partitions on _sdc_batched_at MONTH, not on
-- the business DATE `periodo`. Clustering fields ARE wired in meltano.yml
-- (empresa, idpozo, cuenca) when the loader creates the table.
--
-- Blocked until a SA can write to project vaca-muerta-pulse / dataset raw_cap4.
-- Replace `raw_cap4_dev` with `raw_cap4` in prod.
--
-- Verify loader-native partition/cluster:
--   SELECT table_name, ddl
--   FROM `vaca-muerta-pulse.raw_cap4_dev.INFORMATION_SCHEMA.TABLES`
--   WHERE table_name = 'produccion_pozo_mes';

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
