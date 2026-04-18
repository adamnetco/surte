-- Ensure phone is unique so upsert(onConflict: phone) works correctly
-- and to prevent duplicate WhatsApp subscriptions

-- Step 1: deduplicate any existing duplicates, keeping the most recent
DELETE FROM public.notification_subscriptions a
USING public.notification_subscriptions b
WHERE a.phone = b.phone
  AND a.created_at < b.created_at;

-- Step 2: add unique index on phone
CREATE UNIQUE INDEX IF NOT EXISTS notification_subscriptions_phone_unique
  ON public.notification_subscriptions (phone);

COMMENT ON INDEX public.notification_subscriptions_phone_unique IS
  'Ensures a single subscription per WhatsApp phone number; required by upsert(onConflict: phone).';