-- Hotfix: seed catalogue data (saas_plans, feature_flags) so /planes and
-- entitlement gates render in environments where data was never replicated.
-- Idempotent: re-runnable without duplicating rows.

INSERT INTO public.saas_plans (key, name, description, price_monthly, price_yearly, currency, trial_days, modules, limits, is_public, sort_order)
VALUES
  ('free',       'Free',       'Para empezar a probar SURTÉ YA POS.',                    0,      0, 'COP', 14,
   '["pos_counter"]'::jsonb,
   '{"users": 2, "products": 50, "locations": 1, "einvoices_month": 0}'::jsonb, true, 1),
  ('pro',        'Pro',        'POS + inventario multi-bodega + facturación DIAN.',  79000, 790000, 'COP', 14,
   '["pos_counter", "pos_tables", "inventory_multi_warehouse", "einvoice_innapsis"]'::jsonb,
   '{"users": 5, "products": 2000, "locations": 1, "einvoices_month": 300}'::jsonb, true, 2),
  ('business',   'Business',   'Multi-sucursal, KDS, reportes avanzados.',          169000, 1690000, 'COP', 14,
   '["pos_counter", "pos_tables", "kds", "inventory_multi_warehouse", "einvoice_innapsis", "reports_advanced"]'::jsonb,
   '{"users": 25, "products": 20000, "locations": 5, "einvoices_month": 2000}'::jsonb, true, 3),
  ('enterprise', 'Enterprise', 'Multi-tenant, integraciones a medida, SLA.',             0,      0, 'COP', 14,
   '["*"]'::jsonb,
   '{"users": -1, "products": -1, "locations": -1, "einvoices_month": -1}'::jsonb, true, 4)
ON CONFLICT (key) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  modules       = EXCLUDED.modules,
  limits        = EXCLUDED.limits,
  is_public     = EXCLUDED.is_public,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = now();

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('refactor.modules-layout',    false, 'Etapa 1 — mover a src/modules/<dominio>'),
  ('refactor.tanstack-query',    false, 'Etapa 2 — capa de datos con TanStack Query'),
  ('refactor.zustand-stores',    false, 'Etapa 3 — Zustand para cart/agent/swipe'),
  ('refactor.zod-everywhere',    false, 'Etapa 4 — Zod en cliente y edge functions'),
  ('refactor.design-tokens-lint',false, 'Etapa 5 — lint contra colores literales'),
  ('refactor.bundle-splitting',  false, 'Etapa 6 — code splitting por módulo')
ON CONFLICT (key) DO NOTHING;
