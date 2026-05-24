
-- Hide internal pricing from anonymous visitors
REVOKE SELECT (cost_price, price_wholesale, price_distributor)
  ON public.products FROM anon;

-- Hide reviewer contact data from anonymous visitors
REVOKE SELECT (customer_email, customer_phone)
  ON public.customer_reviews FROM anon;
