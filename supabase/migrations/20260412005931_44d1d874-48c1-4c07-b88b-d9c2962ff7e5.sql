ALTER TABLE public.modifier_groups
ADD COLUMN pricing_mode text NOT NULL DEFAULT 'sum';

COMMENT ON COLUMN public.modifier_groups.pricing_mode IS 'sum = add all adjustments, max_price = charge only the highest adjustment (pizza-style)';
