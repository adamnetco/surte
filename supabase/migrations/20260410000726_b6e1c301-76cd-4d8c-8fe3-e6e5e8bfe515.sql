
-- 1. Add customer_email to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;

-- 2. Create customer_reviews table
CREATE TABLE public.customer_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  admin_response text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reviews"
  ON public.customer_reviews FOR INSERT
  WITH CHECK (customer_name IS NOT NULL AND comment IS NOT NULL AND rating >= 1 AND rating <= 5);

CREATE POLICY "Approved reviews are public"
  ON public.customer_reviews FOR SELECT
  USING (is_approved = true AND is_active = true);

CREATE POLICY "Admins can manage reviews"
  ON public.customer_reviews FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]));

CREATE TRIGGER update_customer_reviews_updated_at
  BEFORE UPDATE ON public.customer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create google_reviews table (manual mirror)
CREATE TABLE public.google_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name text NOT NULL,
  rating integer NOT NULL DEFAULT 5,
  review_text text,
  review_date timestamp with time zone DEFAULT now(),
  profile_photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active google reviews are public"
  ON public.google_reviews FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage google reviews"
  ON public.google_reviews FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role]));

-- 4. Function to associate guest orders on registration
CREATE OR REPLACE FUNCTION public.associate_guest_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_phone text;
BEGIN
  user_email := NEW.email;
  user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', NULL);

  -- Associate by email
  IF user_email IS NOT NULL THEN
    UPDATE public.orders
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND customer_email = user_email;
  END IF;

  -- Associate by phone (strip non-digits for comparison)
  IF user_phone IS NOT NULL THEN
    UPDATE public.orders
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(user_phone, '\D', '', 'g');
  END IF;

  RETURN NEW;
END;
$$;

-- Note: trigger on auth.users is not allowed via migration.
-- We'll handle association in the handle_new_user function instead.

-- Update handle_new_user to also associate guest orders
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, business_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'business_type', 'casa')::business_type
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Associate guest orders by email
  IF NEW.email IS NOT NULL THEN
    UPDATE public.orders
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND customer_email = NEW.email;
  END IF;

  -- Associate guest orders by phone
  IF NEW.raw_user_meta_data->>'phone' IS NOT NULL THEN
    UPDATE public.orders
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND regexp_replace(customer_phone, '\D', '', 'g') = regexp_replace(NEW.raw_user_meta_data->>'phone', '\D', '', 'g');
  END IF;

  RETURN NEW;
END;
$$;
