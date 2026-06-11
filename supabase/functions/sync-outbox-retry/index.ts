// sync-outbox-retry: reset atómico de una fila de sync_outbox para reprocesarla.
// Etapa 18: valida membership (owner/admin) sobre la organization_id del outbox row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsRes } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claimsRes?.claims?.sub;
  if (!userId) return json({ error: "unauthorized" }, 401);

  try {
    const { id } = await req.json();
    if (!id || typeof id !== "string") return json({ error: "missing_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Carga la fila objetivo para conocer su organization_id.
    const { data: row, error: rowErr } = await admin
      .from("sync_outbox")
      .select("id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return json({ error: "not_found" }, 404);

    // 2. Si tiene org, exige que el caller sea owner/admin activo de esa org
    //    (o master superadmin via has_role).
    if (row.organization_id) {
      const { data: isMaster } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "superadmin",
      });
      let allowed = isMaster === true;
      if (!allowed) {
        const { data: member } = await admin
          .from("organization_members")
          .select("role, is_active")
          .eq("organization_id", row.organization_id)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        allowed = !!member && ["owner", "admin"].includes(String(member.role));
      }
      if (!allowed) return json({ error: "forbidden" }, 403);
    } else {
      // Filas legacy sin org: solo superadmin master.
      const { data: isMaster } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "superadmin",
      });
      if (isMaster !== true) return json({ error: "forbidden" }, 403);
    }

    const { data, error } = await admin
      .from("sync_outbox")
      .update({
        status: "pending",
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", id)
      .select("id, target")
      .maybeSingle();
    if (error) throw error;

    return json({ ok: true, id: data!.id, target: data!.target });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
