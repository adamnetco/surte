// Atomic onboarding: create organization + owner user + role + modules + optional domain.
// Caller must be authenticated and superadmin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out + "!" + Math.floor(Math.random() * 90 + 10);
}

function normSlug(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate caller is superadmin
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isSuper } = await admin.rpc("is_master_superadmin", { _user_id: userData.user.id });
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "superadmin").maybeSingle();
      allowed = !!roleRow;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const slug = normSlug(body.slug ?? "");
    const name = (body.name ?? "").trim();
    const tax_id = body.tax_id ?? null;
    const business_type = body.business_type || "retail";
    const owner_email = (body.owner_email ?? "").trim().toLowerCase();
    const owner_full_name = (body.owner_full_name ?? "").trim();
    const owner_phone = body.owner_phone ?? null;
    const modules: string[] = Array.isArray(body.modules) ? body.modules : [];
    const domain: string | null = body.domain ? String(body.domain).trim().toLowerCase() : null;

    if (!slug || !name || !owner_email) {
      return new Response(JSON.stringify({ error: "missing_fields", detail: "slug, name, owner_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Slug uniqueness
    const { data: existingOrg } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (existingOrg) {
      return new Response(JSON.stringify({ error: "slug_exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create or reuse owner user
    const generated_password = randomPassword(10);
    let owner_user_id: string | null = null;
    let password_returned: string | null = null;

    // Try to find user by email
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listed?.users?.find((u) => (u.email ?? "").toLowerCase() === owner_email);
    if (existing) {
      owner_user_id = existing.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: owner_email,
        password: generated_password,
        email_confirm: true,
        user_metadata: { full_name: owner_full_name, phone: owner_phone, business_type: "casa" },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: "create_user_failed", detail: createErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      owner_user_id = created.user.id;
      password_returned = generated_password;
    }

    // Create organization
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ slug, name, business_type, tax_id, country: "CO", currency: "COP" })
      .select("id, slug, name")
      .single();
    if (orgErr || !org) {
      return new Response(JSON.stringify({ error: "create_org_failed", detail: orgErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Membership as owner
    await admin.from("organization_members").upsert(
      { organization_id: org.id, user_id: owner_user_id!, role: "owner", is_active: true, invited_by: userData.user.id },
      { onConflict: "organization_id,user_id" }
    );

    // Global role admin for owner (if not already a higher role)
    await admin.from("user_roles").upsert({ user_id: owner_user_id!, role: "admin" }, { onConflict: "user_id,role" });

    // Enable selected modules
    if (modules.length > 0) {
      const rows = modules.map((m) => ({ organization_id: org.id, module_key: m, enabled: true }));
      const { error: modErr } = await admin.from("organization_modules").upsert(rows, { onConflict: "organization_id,module_key" });
      if (modErr) console.warn("modules upsert warning:", modErr.message);
    }

    // Optional domain
    let domain_row: any = null;
    if (domain) {
      // tenant_sites may be required as parent — try lookup or skip silently
      const { data: site } = await admin.from("tenant_sites").select("id").eq("organization_id", org.id).maybeSingle();
      if (site) {
        const { data: dom, error: domErr } = await admin
          .from("tenant_domains")
          .insert({ site_id: site.id, organization_id: org.id, hostname: domain, is_primary: true })
          .select()
          .maybeSingle();
        if (domErr) console.warn("domain insert warning:", domErr.message);
        domain_row = dom;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        organization_id: org.id,
        slug: org.slug,
        name: org.name,
        owner_user_id,
        owner_email,
        generated_password: password_returned, // null if user already existed
        modules,
        domain: domain_row?.hostname ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("tenant-create-with-owner error", e);
    return new Response(JSON.stringify({ error: "internal", detail: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
