CREATE POLICY "superadmin reads all routing alert notifications"
  ON public.routing_alert_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));