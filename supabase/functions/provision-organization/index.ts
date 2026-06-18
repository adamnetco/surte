// DEPRECATED (Fase 2 — C3).
// Este endpoint quedó superado por `tenant-create-with-owner`, que ejecuta el
// mismo flujo (crear org + owner + módulos) y además provisiona tenant_sites,
// dominio automático *.sistecpos.com y kickoff de Cloudflare Custom Hostname.
//
// Para evitar dejar dos rutas de creación de organización (riesgo de tenants
// "a medias" cuando un webhook llama a la ruta vieja), aquí devolvemos
// `410 Gone` con instrucciones de migración. Si necesitas reactivar el flujo
// de magic-link / Ed25519 keypair para desktop, hazlo dentro de
// `tenant-create-with-owner` como opción `provision_desktop_keys: true`.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "deprecated",
      message:
        "provision-organization fue deprecado en Fase 2. Usa la edge function 'tenant-create-with-owner' (mismo payload básico: slug, name, owner_email, owner_full_name, modules[], domain?).",
      replacement: "tenant-create-with-owner",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
