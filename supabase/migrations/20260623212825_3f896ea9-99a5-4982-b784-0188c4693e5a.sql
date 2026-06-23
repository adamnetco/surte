
-- 1) fx_pricing_rules
CREATE TABLE IF NOT EXISTS public.fx_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pair_id UUID NOT NULL REFERENCES public.fx_pairs(id) ON DELETE CASCADE,
  base_source TEXT NOT NULL DEFAULT 'manual' CHECK (base_source IN ('manual','trm_banrep','api')),
  spread_buy_pct NUMERIC(8,4) NOT NULL DEFAULT 0.5,   -- % por debajo de la base para compra
  spread_sell_pct NUMERIC(8,4) NOT NULL DEFAULT 0.5,  -- % por encima de la base para venta
  min_buy NUMERIC(18,6),
  max_buy NUMERIC(18,6),
  min_sell NUMERIC(18,6),
  max_sell NUMERIC(18,6),
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, pair_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_pricing_rules TO authenticated;
GRANT ALL ON public.fx_pricing_rules TO service_role;

ALTER TABLE public.fx_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_pricing_rules_select"
  ON public.fx_pricing_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = fx_pricing_rules.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "fx_pricing_rules_modify"
  ON public.fx_pricing_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = fx_pricing_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = fx_pricing_rules.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_fx_pricing_rules_org_pair ON public.fx_pricing_rules(organization_id, pair_id);

CREATE OR REPLACE FUNCTION public.fx_pricing_rules_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_fx_pricing_rules_updated_at ON public.fx_pricing_rules;
CREATE TRIGGER trg_fx_pricing_rules_updated_at
  BEFORE UPDATE ON public.fx_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.fx_pricing_rules_set_updated_at();

-- 2) Extender fx_rates con publicación + base
ALTER TABLE public.fx_rates ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.fx_rates ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.fx_rates ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id);
ALTER TABLE public.fx_rates ADD COLUMN IF NOT EXISTS base_rate NUMERIC(18,6);

CREATE INDEX IF NOT EXISTS idx_fx_rates_org_pair_effective
  ON public.fx_rates(organization_id, pair_id, effective_at DESC);

-- 3) Función: calcular compra/venta desde base + regla
CREATE OR REPLACE FUNCTION public.fx_apply_pricing_rule(
  _base NUMERIC,
  _rule public.fx_pricing_rules
) RETURNS TABLE(buy_rate NUMERIC, sell_rate NUMERIC)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_buy NUMERIC;
  v_sell NUMERIC;
BEGIN
  v_buy  := round(_base * (1 - (_rule.spread_buy_pct  / 100.0)), 6);
  v_sell := round(_base * (1 + (_rule.spread_sell_pct / 100.0)), 6);

  IF _rule.min_buy  IS NOT NULL AND v_buy  < _rule.min_buy  THEN v_buy  := _rule.min_buy;  END IF;
  IF _rule.max_buy  IS NOT NULL AND v_buy  > _rule.max_buy  THEN v_buy  := _rule.max_buy;  END IF;
  IF _rule.min_sell IS NOT NULL AND v_sell < _rule.min_sell THEN v_sell := _rule.min_sell; END IF;
  IF _rule.max_sell IS NOT NULL AND v_sell > _rule.max_sell THEN v_sell := _rule.max_sell; END IF;

  RETURN QUERY SELECT v_buy, v_sell;
END;
$$;

-- 4) Función publicar tasa (valida pertenencia y reglas)
CREATE OR REPLACE FUNCTION public.fx_publish_rate(
  _pair_id UUID,
  _buy_rate NUMERIC,
  _sell_rate NUMERIC,
  _source TEXT DEFAULT 'manual',
  _base_rate NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_rate_id UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.fx_pairs WHERE id = _pair_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Par no existe'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org AND user_id = auth.uid()
      AND role IN ('owner','admin','manager')
  ) THEN
    RAISE EXCEPTION 'No autorizado para publicar tasas';
  END IF;

  IF _buy_rate <= 0 OR _sell_rate <= 0 THEN
    RAISE EXCEPTION 'Tasas deben ser positivas';
  END IF;
  IF _sell_rate < _buy_rate THEN
    RAISE EXCEPTION 'Venta no puede ser menor que compra';
  END IF;

  INSERT INTO public.fx_rates(
    organization_id, pair_id, buy_rate, sell_rate, source,
    effective_at, created_by, is_published, published_at, published_by, base_rate
  ) VALUES (
    v_org, _pair_id, _buy_rate, _sell_rate, COALESCE(_source,'manual'),
    now(), auth.uid(), true, now(), auth.uid(), _base_rate
  ) RETURNING id INTO v_rate_id;

  RETURN v_rate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fx_publish_rate(UUID,NUMERIC,NUMERIC,TEXT,NUMERIC) TO authenticated;
