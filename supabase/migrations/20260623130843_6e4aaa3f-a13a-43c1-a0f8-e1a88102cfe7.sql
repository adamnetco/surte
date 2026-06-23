-- Registra "Casas de Cambio" (fx) en el catálogo de módulos
-- para que aparezca en /superadmin/t/:slug/modulos y se pueda
-- habilitar/deshabilitar por tenant vía entitlements.
INSERT INTO public.modules (key, name, description, category, sort_order, is_active) VALUES
  ('fx', 'Casas de Cambio', 'Operaciones de compra/venta de divisas (FX) con UIAF y multi-divisa.', 'verticals', 95, true)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      is_active = true;