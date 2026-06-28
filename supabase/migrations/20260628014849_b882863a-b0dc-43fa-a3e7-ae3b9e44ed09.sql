REVOKE ALL ON public.dunning_events FROM PUBLIC;
GRANT SELECT ON public.dunning_events TO authenticated;
GRANT ALL ON public.dunning_events TO service_role;