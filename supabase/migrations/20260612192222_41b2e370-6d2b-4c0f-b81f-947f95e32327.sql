DROP POLICY IF EXISTS "Scoped realtime subscriptions" ON realtime.messages;

CREATE POLICY "Scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
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
  OR (realtime.topic() ~ '^my-orders:[0-9a-f-]{36}$'
      AND (split_part(realtime.topic(), ':', 2))::uuid = auth.uid())
  -- Per-resource channels: now REQUIRE UUID suffix (unguessable).
  OR realtime.topic() ~ '^persistent_cart:[0-9a-f-]{36}$'
  OR realtime.topic() ~ '^order-[0-9a-f-]{36}$'
  OR realtime.topic() ~ '^ticket-[0-9a-f-]{36}$'
  OR realtime.topic() ~ '^table-[0-9a-f-]{36}$'
);