import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.slice(0, 320) : null;
    const success = Boolean(body.success);
    const method = typeof body.method === "string" ? body.method.slice(0, 32) : "password";
    const details = typeof body.details === "object" && body.details !== null ? body.details : {};
    const userAgent = req.headers.get("user-agent") ?? null;
    const ipHeader = req.headers.get("x-forwarded-for") ?? "";
    const ip = ipHeader.split(",")[0]?.trim() || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    if (email) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("email" as never, email)
        .maybeSingle();
      userId = (data as { user_id?: string } | null)?.user_id ?? null;
    }

    const { error } = await supabase.from("auth_login_events").insert({
      user_id: userId,
      email,
      method,
      success,
      ip,
      user_agent: userAgent,
      details,
    });

    if (error) {
      console.error("log-login-attempt insert error", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-login-attempt fatal", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
