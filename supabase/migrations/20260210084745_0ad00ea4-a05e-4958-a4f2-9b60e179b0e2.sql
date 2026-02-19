-- Drop empty legacy duplicate tables
-- service_catalog (0 rows) — replaced by services_catalog
-- vehicle_catalog (0 rows) — replaced by vehicle_registry

DROP TABLE IF EXISTS public.service_catalog;
DROP TABLE IF EXISTS public.vehicle_catalog;