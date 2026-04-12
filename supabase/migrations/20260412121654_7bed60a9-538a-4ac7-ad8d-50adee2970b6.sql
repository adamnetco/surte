CREATE POLICY "Agents can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'agente'::app_role))
  WITH CHECK (has_role(auth.uid(), 'agente'::app_role));