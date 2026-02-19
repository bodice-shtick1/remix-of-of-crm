-- Seed system services (idempotent)
INSERT INTO public.services_catalog (name, default_price, category, is_active, is_roundable)
SELECT 'Составление ДКП ТС', 1500, 'documents', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.services_catalog WHERE name = 'Составление ДКП ТС');

INSERT INTO public.services_catalog (name, default_price, category, is_active, is_roundable)
SELECT 'Оформление Европротокола', 1000, 'documents', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.services_catalog WHERE name = 'Оформление Европротокола');