-- Ola 16 audit fix: eliminar overload legacy de consume_limit que causa ambigüedad PGRST203.
-- La versión canónica usa parámetros p_org_id / p_limit_key / p_amount / p_period_key
-- (usada por useLimitGuard, principal gate de la app). La variante _org_id/_limit_key/_delta/_period
-- queda obsoleta; el frontend se migra a la firma p_*.
DROP FUNCTION IF EXISTS public.consume_limit(uuid, text, bigint, text);