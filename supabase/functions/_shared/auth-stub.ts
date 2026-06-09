// Shared helpers for auth-* edge function stubs.
// When Lovable Cloud comes back and the migration in
// `.lovable/pending-migrations/auth-system.sql` is applied, replace the
// `notReady()` calls with the real implementations.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Returned by every stub until the `auth_*` tables and AUTH_ENCRYPTION_KEY
 * secret exist. UI must treat this as a soft failure and fall back to the
 * existing email+password flow.
 */
export function notReady(name: string): Response {
  return json(
    {
      error: "auth_subsystem_not_ready",
      function: name,
      message:
        "Auth refactor pending: apply .lovable/pending-migrations/auth-system.sql and set AUTH_ENCRYPTION_KEY.",
    },
    503,
  );
}

export async function safeJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
