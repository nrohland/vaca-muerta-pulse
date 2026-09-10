-- Evidence queries for Hito 1 (no secrets). Run after a successful append.
-- Dataset: raw_cap4_dev (dev) or raw_cap4 (prod).

-- 1. Final table must have rows (Bug 1 left it at 0 while staging had data).
SELECT
  'produccion_pozo_mes' AS table_name,
  COUNT(*) AS row_count
FROM `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes`;

-- 2. Staging leftovers from overwrite:true (safe to DROP after final COUNT > 0).
SELECT table_name
FROM `vaca-muerta-pulse.raw_cap4_dev.INFORMATION_SCHEMA.TABLES`
WHERE table_name LIKE 'produccion_pozo_mes__%';

-- 3. Partition + cluster (expect MONTH on _sdc_batched_at; cluster empresa,idpozo,cuenca).
SELECT
  table_name,
  ddl
FROM `vaca-muerta-pulse.raw_cap4_dev.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'produccion_pozo_mes';

SELECT
  table_name,
  clustering_ordinal_position,
  column_name
FROM `vaca-muerta-pulse.raw_cap4_dev.INFORMATION_SCHEMA.CLUSTERING_COLUMNS`
WHERE table_name = 'produccion_pozo_mes'
ORDER BY clustering_ordinal_position;

-- 4. Partitions actually written (TIMESTAMP_TRUNC month of _sdc_batched_at).
SELECT
  partition_id,
  total_rows
FROM `vaca-muerta-pulse.raw_cap4_dev.INFORMATION_SCHEMA.PARTITIONS`
WHERE table_name = 'produccion_pozo_mes'
ORDER BY partition_id;
