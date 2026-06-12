-- Tighten realtime.messages RLS to prevent cross-tenant data leaks via global channel names
DROP POLICY IF EXISTS "Scoped realtime subscriptions" ON realtime.messages;

CREATE POLICY "Scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Personal user channel
  realtime.topic() = ('user:' || auth.uid()::text)

  -- Per-org channels: <prefix>:<org_uuid>
  OR (realtime.topic() ~ '^health_events:[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(realtime.topic(), ':', 2))::uuid))

  OR (realtime.topic() ~ '^admin-orders:[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(realtime.topic(), ':', 2))::uuid))

  OR (realtime.topic() ~ '^kds:[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(realtime.topic(), ':', 2))::uuid))

  OR (realtime.topic() ~ '^mesas:[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(realtime.topic(), ':', 2))::uuid))

  OR (realtime.topic() ~ '^sync_logs:[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(realtime.topic(), ':', 2))::uuid))

  OR (realtime.topic() ~ '^sync_outbox:[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(realtime.topic(), ':', 2))::uuid))

  OR (realtime.topic() ~ '^print_jobs_[0-9a-f-]{36}$'
      AND public.is_member_of((SUBSTRING(realtime.topic() FROM 12))::uuid))

  -- Personal "my-orders" channel must match the user
  OR (realtime.topic() ~ '^my-orders:[0-9a-f-]{36}$'
      AND (split_part(realtime.topic(), ':', 2))::uuid = auth.uid())

  -- Per-resource channels gated by UUID unguessability (resource RLS still applies on fetch)
  OR realtime.topic() ~~ 'persistent_cart:%'
  OR realtime.topic() ~~ 'order-%'
  OR realtime.topic() ~~ 'ticket-%'
  OR realtime.topic() ~~ 'table-%'
);
