// Generate 10 single-use recovery codes; invalidates old unused ones.
import { preflight, json, corsHeaders } from "../_shared/auth-stub.ts";
import { userFromRequest, serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { generateRecoveryCodes, hashRecovery } from "../_shared/auth-crypto.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  // Invalidate previous unused codes
  await sb.from("auth_recovery_codes").delete().eq("user_id", user.id).is("used_at", null);

  const codes = generateRecoveryCodes(10);
  const rows = await Promise.all(codes.map(async (c) => ({
    user_id: user.id,
    code_hash: await hashRecovery(c),
  })));
  const { error } = await sb.from("auth_recovery_codes").insert(rows);
  if (error) return json({ error: "insert_failed", details: error.message }, 500);

  await logAuthEvent("recovery_codes_generated", user.id, req, { count: codes.length });
  return new Response(JSON.stringify({ codes }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
