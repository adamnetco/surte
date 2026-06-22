
DROP POLICY IF EXISTS "System can insert broadcast logs" ON public.push_broadcast_logs;
DROP POLICY IF EXISTS "Service role can insert broadcast logs" ON public.push_broadcast_logs;

CREATE POLICY "Service role can insert broadcast logs"
ON public.push_broadcast_logs
FOR INSERT
TO service_role
WITH CHECK (true);

COMMENT ON TABLE public.csp_violations IS 'CSP violation reports. INSERT intentionally open: browsers POST reports without auth credentials. SELECT restricted to admins.';
