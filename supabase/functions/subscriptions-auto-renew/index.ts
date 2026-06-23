import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: renewed, error: e1 } = await supabase.rpc("auto_renew_subscriptions");
    if (e1) throw e1;

    const { data: expired, error: e2 } = await supabase.rpc("expire_overdue_subscriptions");
    if (e2) throw e2;

    return new Response(
      JSON.stringify({
        ok: true,
        renewed_count: renewed?.length ?? 0,
        expired_count: expired?.length ?? 0,
        renewed,
        expired,
        run_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("auto-renew error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
