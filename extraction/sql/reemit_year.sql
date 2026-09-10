-- Re-emit strategy for an annual Capítulo IV CSV / Datastore resource.
-- The published year file is a snapshot (DDJJ may flip rectificado).
-- Do NOT MERGE on an assumed unique key until Hito 2 tests other years.
--
-- 1. Load the year into a staging table or run Meltano with overwrite=false (prod).
-- 2. Delete the year from the landing table, then insert the new extract.
-- Dev smoke of a single year can instead use target-bigquery overwrite: true
-- (environment `dev` in meltano.yml) and skip this script.

-- DECLARE year_to_replace INT64 DEFAULT 2025;

DELETE FROM `vaca-muerta-pulse.raw_cap4.produccion_pozo_mes`
WHERE anio = 2025;

-- Then: MELTANO_ENVIRONMENT=prod meltano run cap4-produccion
-- with CAP4_PRODUCCION_RESOURCE_ID pointing at that year.
