-- Make notification_logs.template_id SET NULL on template deletion
ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_template_id_fkey;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.notification_templates(id)
  ON DELETE SET NULL;

-- Same for automation_rules
ALTER TABLE public.automation_rules
  DROP CONSTRAINT IF EXISTS automation_rules_template_id_fkey;

ALTER TABLE public.automation_rules
  ADD CONSTRAINT automation_rules_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.notification_templates(id)
  ON DELETE SET NULL;

-- Same for mass_broadcasts
ALTER TABLE public.mass_broadcasts
  DROP CONSTRAINT IF EXISTS mass_broadcasts_template_id_fkey;

ALTER TABLE public.mass_broadcasts
  ADD CONSTRAINT mass_broadcasts_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.notification_templates(id)
  ON DELETE SET NULL;