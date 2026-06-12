
-- 1) Tabla plan_limits
CREATE TABLE IF NOT EXISTS public.plan_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  value bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, limit_key)
);

GRANT SELECT ON public.plan_limits TO anon, authenticated;
GRANT ALL ON public.plan_limits TO service_role;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_limits_public_read" ON public.plan_limits;
CREATE POLICY "plan_limits_public_read" ON public.plan_limits
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "plan_limits_superadmin_write" ON public.plan_limits;
CREATE POLICY "plan_limits_superadmin_write" ON public.plan_limits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

DROP TRIGGER IF EXISTS trg_plan_limits_uat ON public.plan_limits;
CREATE TRIGGER trg_plan_limits_uat
  BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Backfill plan_modules con mapeo de claves antiguas → canónicas
DO $$
DECLARE
  p RECORD;
  m text;
  mapped_key text;
  all_module_keys text[];
BEGIN
  SELECT array_agg(key) INTO all_module_keys FROM public.modules;

  FOR p IN SELECT id, key, modules FROM public.saas_plans LOOP
    -- Enterprise → todos los módulos
    IF p.key = 'enterprise' THEN
      FOREACH m IN ARRAY all_module_keys LOOP
        INSERT INTO public.plan_modules (plan_id, module_key, included)
        VALUES (p.id, m, true)
        ON CONFLICT (plan_id, module_key) DO NOTHING;
      END LOOP;
      CONTINUE;
    END IF;

    -- Resto: mapear cada entrada del jsonb
    FOR m IN SELECT jsonb_array_elements_text(p.modules) LOOP
      mapped_key := CASE m
        WHEN '*' THEN NULL
        WHEN 'pos_counter' THEN 'pos'
        WHEN 'pos_tables' THEN 'mesas'
        WHEN 'kds' THEN 'kds'
        WHEN 'inventory_multi_warehouse' THEN 'inventario'
        WHEN 'einvoice_innapsis' THEN 'fiscal'
        WHEN 'reports_advanced' THEN NULL
        ELSE m
      END;

      IF mapped_key IS NULL THEN CONTINUE; END IF;

      IF EXISTS (SELECT 1 FROM public.modules WHERE key = mapped_key) THEN
        INSERT INTO public.plan_modules (plan_id, module_key, included)
        VALUES (p.id, mapped_key, true)
        ON CONFLICT (plan_id, module_key) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3) Trigger: sincronizar saas_plans.modules (jsonb) desde plan_modules
CREATE OR REPLACE FUNCTION public.sync_saas_plan_modules_jsonb()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_plan_id uuid;
  new_modules jsonb;
BEGIN
  target_plan_id := COALESCE(NEW.plan_id, OLD.plan_id);

  SELECT COALESCE(jsonb_agg(module_key ORDER BY module_key), '[]'::jsonb)
    INTO new_modules
  FROM public.plan_modules
  WHERE plan_id = target_plan_id AND included = true;

  UPDATE public.saas_plans
     SET modules = new_modules,
         updated_at = now()
   WHERE id = target_plan_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_saas_plans_modules ON public.plan_modules;
CREATE TRIGGER trg_sync_saas_plans_modules
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_modules
  FOR EACH ROW EXECUTE FUNCTION public.sync_saas_plan_modules_jsonb();

-- 4) Re-sincronizar el jsonb post-backfill
UPDATE public.saas_plans sp
   SET modules = COALESCE((
     SELECT jsonb_agg(pm.module_key ORDER BY pm.module_key)
       FROM public.plan_modules pm
      WHERE pm.plan_id = sp.id AND pm.included = true
   ), '[]'::jsonb),
   updated_at = now();

-- 5) Seeds de límites por plan
INSERT INTO public.plan_limits (plan_id, limit_key, value)
SELECT pk.id, l.limit_key, l.value
  FROM public.saas_plans pk
  CROSS JOIN LATERAL (
    VALUES
      ('max_terminals',         CASE pk.key WHEN 'free' THEN 1   WHEN 'pro' THEN 3    WHEN 'business' THEN 10   ELSE NULL END),
      ('max_users',             CASE pk.key WHEN 'free' THEN 2   WHEN 'pro' THEN 10   WHEN 'business' THEN 30   ELSE NULL END),
      ('max_locations',         CASE pk.key WHEN 'free' THEN 1   WHEN 'pro' THEN 2    WHEN 'business' THEN 5    ELSE NULL END),
      ('max_products',          CASE pk.key WHEN 'free' THEN 100 WHEN 'pro' THEN 5000 WHEN 'business' THEN 50000 ELSE NULL END),
      ('max_api_calls_monthly', CASE pk.key WHEN 'free' THEN 1000 WHEN 'pro' THEN 50000 WHEN 'business' THEN 500000 ELSE NULL END)
  ) AS l(limit_key, value)
ON CONFLICT (plan_id, limit_key) DO NOTHING;

COMMENT ON TABLE public.plan_limits IS 'Cuotas por plan (NULL = ilimitado).';
COMMENT ON TABLE public.plan_modules IS 'Fuente única de módulos por plan. saas_plans.modules se sincroniza vía trigger.';
COMMENT ON COLUMN public.saas_plans.modules IS 'DEPRECADO como fuente de escritura. Sincronizado automáticamente desde plan_modules.';
