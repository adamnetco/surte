
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS price_wholesale numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_distributor numeric DEFAULT NULL;

-- Update seed products with example tiered prices
UPDATE public.products SET price_wholesale = price * 0.85, price_distributor = price * 0.72 WHERE is_wholesale = true;
UPDATE public.products SET price_wholesale = price * 0.90 WHERE is_wholesale = false;
