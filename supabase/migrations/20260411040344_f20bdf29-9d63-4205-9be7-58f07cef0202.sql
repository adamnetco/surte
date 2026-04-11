
-- Modifier groups: categories of modifiers per product
CREATE TABLE public.modifier_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  selection_type TEXT NOT NULL DEFAULT 'single',
  min_selections INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Modifier options: individual choices within a group
CREATE TABLE public.modifier_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  linked_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_modifier_groups_product ON public.modifier_groups(product_id);
CREATE INDEX idx_modifier_options_group ON public.modifier_options(modifier_group_id);
CREATE INDEX idx_modifier_options_linked ON public.modifier_options(linked_product_id);

-- RLS
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;

-- Everyone can view
CREATE POLICY "Modifier groups viewable by everyone"
  ON public.modifier_groups FOR SELECT
  USING (true);

CREATE POLICY "Modifier options viewable by everyone"
  ON public.modifier_options FOR SELECT
  USING (true);

-- Admins/editors can manage
CREATE POLICY "Admins can manage modifier groups"
  ON public.modifier_groups FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]));

CREATE POLICY "Admins can manage modifier options"
  ON public.modifier_options FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]));

-- Updated_at triggers
CREATE TRIGGER update_modifier_groups_updated_at
  BEFORE UPDATE ON public.modifier_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modifier_options_updated_at
  BEFORE UPDATE ON public.modifier_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
