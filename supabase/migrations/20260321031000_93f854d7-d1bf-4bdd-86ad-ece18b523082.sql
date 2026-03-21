
-- Notification preferences for WhatsApp alerts
CREATE TABLE public.notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  notify_offers boolean DEFAULT true,
  notify_fresh boolean DEFAULT true,
  notify_new_products boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(phone)
);

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
ON public.notification_subscriptions FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions"
ON public.notification_subscriptions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can subscribe"
ON public.notification_subscriptions FOR INSERT
WITH CHECK (true);

CREATE TRIGGER update_notification_subscriptions_updated_at
BEFORE UPDATE ON public.notification_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
