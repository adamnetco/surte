
-- 1) cost_price: revocar lectura anónima a nivel de columna
REVOKE SELECT (cost_price) ON public.products FROM anon;

-- 2) feature_flags: restringir lectura a autenticados
DROP POLICY IF EXISTS feature_flags_read_all ON public.feature_flags;
CREATE POLICY feature_flags_read_authenticated
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.feature_flags FROM anon;
