-- Revoke anonymous read on sensitive pricing columns
REVOKE SELECT (cost_price, price_wholesale, price_distributor) ON public.products FROM anon;

-- Ensure authenticated and service_role retain access
GRANT SELECT (cost_price, price_wholesale, price_distributor) ON public.products TO authenticated;
GRANT SELECT (cost_price, price_wholesale, price_distributor) ON public.products TO service_role;