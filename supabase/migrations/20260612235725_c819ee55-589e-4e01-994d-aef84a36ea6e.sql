INSERT INTO public.critical_action_types(action_type, label, description, requires_cosign, expires_minutes) VALUES
  ('single_module_override', 'Anulación de módulo (individual)', 'Habilita/deshabilita un módulo en UNA tienda. Auditado, sin co-firma.', false, 30),
  ('single_limit_override',  'Anulación de límite (individual)', 'Modifica un límite en UNA tienda. Auditado, sin co-firma.', false, 30)
ON CONFLICT (action_type) DO NOTHING;