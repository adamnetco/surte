
-- Create business_type enum
CREATE TYPE public.business_type AS ENUM ('detal', 'horeca', 'minimercado', 'distribuidor');

-- Add business_type column to profiles
ALTER TABLE public.profiles ADD COLUMN business_type public.business_type NOT NULL DEFAULT 'detal';

-- Allow admins to view all profiles (needed for admin panel)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
