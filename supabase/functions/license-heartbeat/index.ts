// Heartbeat: el desktop llama cada N minutos para confirmar que la terminal sigue válida.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { license_key, fingerprint } = await req.json();
    if (!license_key || !fingerprint) throw new Error("missing fields");
    const { data, error } = await supa.rpc("heartbeat_activation", { _license_key: license_key, _fingerprint: fingerprint });
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
