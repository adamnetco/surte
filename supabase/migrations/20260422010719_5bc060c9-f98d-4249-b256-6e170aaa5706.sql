CREATE TABLE IF NOT EXISTS public.seo_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('category','brand','city','tag')),
  entity_slug text NOT NULL,
  city_scope  text,
  heading     text,
  body_html   text,
  faqs        jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_slug, city_scope)
);

CREATE INDEX IF NOT EXISTS idx_seo_content_lookup
  ON public.seo_content (entity_type, entity_slug, city_scope) WHERE is_active = true;

ALTER TABLE public.seo_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SEO content readable by everyone"
  ON public.seo_content FOR SELECT USING (true);

CREATE POLICY "Admins manage seo_content"
  ON public.seo_content FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role,'editor'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role,'editor'::app_role]));

CREATE TRIGGER seo_content_updated_at
  BEFORE UPDATE ON public.seo_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth   text NOT NULL,
  user_agent text,
  notify_offers boolean NOT NULL DEFAULT true,
  notify_news   boolean NOT NULL DEFAULT true,
  notify_order_updates boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to push"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL);

CREATE POLICY "Users manage own push subs"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins manage all push subs"
  ON public.push_subscriptions FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role]));

CREATE TRIGGER push_subs_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.push_broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  icon text,
  segment text NOT NULL DEFAULT 'all',
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  errors jsonb,
  sent_by uuid,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_broadcast_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage push_broadcast_logs"
  ON public.push_broadcast_logs FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'superadmin'::app_role]));