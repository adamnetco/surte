// Service-role client + auth helpers for auth-* edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function userFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authz = req.headers.get("authorization");
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7);
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function logAuthEvent(
  event: string,
  user_id: string | null,
  req: Request,
  details: Record<string, unknown> = {},
  risk_score = 0,
) {
  try {
    const sb = serviceClient();
    await sb.from("auth_login_events").insert({
      event,
      user_id,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
      risk_score,
      details,
    });
  } catch (_e) { /* swallow */ }
}
