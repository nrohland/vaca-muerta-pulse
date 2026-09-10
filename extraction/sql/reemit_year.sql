-- Re-emit strategy for an annual Capítulo IV CSV / Datastore resource.
-- The published year file is a snapshot (DDJJ may flip rectificado).
-- Do NOT MERGE / upsert on an assumed unique key until Hito 2 tests other years.
--
-- Bug 1: z3z1ma overwrite:true uses CREATE OR REPLACE TABLE … AS SELECT *
-- which STRIPS partitioning (new=none). Do not turn overwrite back on.
--
-- Dev (un año en raw_cap4_dev):
--   1. TRUNCATE TABLE …produccion_pozo_mes;   -- keeps MONTH(_sdc_batched_at)+cluster
--      OR DELETE WHERE anio = 2025;           -- same idea, year-scoped
--   2. MELTANO_ENVIRONMENT=dev meltano run cap4-produccion
--
-- Prod (histórico multi-año en raw_cap4):
--   1. DELETE WHERE anio = @year
--   2. MELTANO_ENVIRONMENT=prod meltano run cap4-produccion
--      with TAP_CKAN_DATASTORE_PRODUCCION_RESOURCE_ID for that year.
--
-- Or: python scripts/prepare_year_load.py --dataset raw_cap4 --delete-year 2025

-- Dev example (uncomment one):
-- TRUNCATE TABLE `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes`;
-- DELETE FROM `vaca-muerta-pulse.raw_cap4_dev.produccion_pozo_mes` WHERE anio = 2025;

DELETE FROM `vaca-muerta-pulse.raw_cap4.produccion_pozo_mes`
WHERE anio = 2025;

-- Then: MELTANO_ENVIRONMENT=prod meltano run cap4-produccion
