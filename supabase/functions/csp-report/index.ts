// csp-report: recibe reportes de violación CSP del navegador y los persiste.
// Endpoint público (anon). Acepta payload del listener cliente o report-uri estándar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    // Soporta dos formatos: SecurityPolicyViolationEvent serializado
    // y { "csp-report": {...} } del header report-uri legacy.
    const r = raw["csp-report"] ?? raw;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("csp_violations").insert({
      document_uri: r.documentURI ?? r["document-uri"] ?? null,
      violated_directive: r.violatedDirective ?? r["violated-directive"] ?? null,
      effective_directive: r.effectiveDirective ?? r["effective-directive"] ?? null,
      blocked_uri: r.blockedURI ?? r["blocked-uri"] ?? null,
      source_file: r.sourceFile ?? r["source-file"] ?? null,
      line_number: r.lineNumber ?? r["line-number"] ?? null,
      column_number: r.columnNumber ?? r["column-number"] ?? null,
      disposition: r.disposition ?? null,
      status_code: r.statusCode ?? r["status-code"] ?? null,
      user_agent: req.headers.get("user-agent"),
      organization_id: raw.organization_id ?? null,
      raw: raw,
    });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
