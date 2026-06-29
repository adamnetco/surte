// Slice N — Notifica a admins/owners de cada org sobre alertas de enrutamiento
// no silenciadas (reglas activas sin uso ≥7d, impresoras activas sin jobs ≥24h).
// Respeta routing_alert_mutes y deduplica por (org, kind, target, día) usando
// routing_alert_notifications.
//
// Invocación:
//   POST { organization_id?: uuid }  → si se omite, recorre todas las orgs.
// Envíos: email (send-transactional-email) + WhatsApp (send-ycloud-whatsapp).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_RULE_IDLE = 7;
const HOURS_PRINTER_IDLE = 24;
const DASHBOARD_URL = "https://admin.sistecpos.com/admin";

interface Rule {
  id: string; printer_id: string; is_active: boolean;
  product_id: string | null; category_id: string | null; kitchen_station_id: string | null;
}
interface Printer { id: string; name: string; role: string | null; is_active: boolean; }
interface Job { printer_id: string | null; created_at: string; payload: any; }

async function notifyOrg(supabase: any, organization_id: string) {
  const [orgRes, rulesRes, printersRes, mutesRes, productsRes, categoriesRes, stationsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, whatsapp_phone, support_email").eq("id", organization_id).maybeSingle(),
    supabase.from("printer_routing_rules").select("id, printer_id, is_active, product_id, category_id, kitchen_station_id").eq("organization_id", organization_id).eq("is_active", true),
    supabase.from("printers").select("id, name, role, is_active").eq("organization_id", organization_id).eq("is_active", true),
    supabase.from("routing_alert_mutes").select("target_kind, target_id").eq("organization_id", organization_id).gt("muted_until", new Date().toISOString()),
    supabase.from("products").select("id, name").eq("organization_id", organization_id).limit(2000),
    supabase.from("categories").select("id, name"),
    supabase.from("kitchen_stations").select("id, name").eq("organization_id", organization_id),
  ]);

  const org = orgRes.data;
  if (!org) return { organization_id, skipped: "org_not_found" };
  const rules: Rule[] = rulesRes.data ?? [];
  const printers: Printer[] = printersRes.data ?? [];
  const mutedRules = new Set((mutesRes.data ?? []).filter((m: any) => m.target_kind === "rule").map((m: any) => m.target_id));
  const mutedPrinters = new Set((mutesRes.data ?? []).filter((m: any) => m.target_kind === "printer").map((m: any) => m.target_id));
  const products = new Map((productsRes.data ?? []).map((p: any) => [p.id, p.name]));
  const categories = new Map((categoriesRes.data ?? []).map((c: any) => [c.id, c.name]));
  const stations = new Map((stationsRes.data ?? []).map((s: any) => [s.id, s.name]));

  const since = new Date(Date.now() - DAYS_RULE_IDLE * 86400000).toISOString();
  const { data: jobs } = await supabase
    .from("print_jobs")
    .select("printer_id, created_at, payload")
    .eq("organization_id", organization_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const ruleLast = new Map<string, string>();
  const printerLast = new Map<string, string>();
  for (const j of (jobs ?? []) as Job[]) {
    if (j.printer_id && !printerLast.has(j.printer_id)) printerLast.set(j.printer_id, j.created_at);
    const rs = j.payload?.routing?.rules ?? [];
    for (const r of rs) {
      if (r?.rule_id && !ruleLast.has(r.rule_id)) ruleLast.set(r.rule_id, j.created_at);
    }
  }
  const now = Date.now();
  const idleRules = rules
    .filter((r) => !mutedRules.has(r.id))
    .map((r) => ({ rule: r, lastAt: ruleLast.get(r.id) ?? null }))
    .filter((x) => !x.lastAt || (now - new Date(x.lastAt).getTime()) >= DAYS_RULE_IDLE * 86400000);
  const idlePrinters = printers
    .filter((p) => !mutedPrinters.has(p.id))
    .map((p) => ({ printer: p, lastAt: printerLast.get(p.id) ?? null }))
    .filter((x) => !x.lastAt || (now - new Date(x.lastAt).getTime()) >= HOURS_PRINTER_IDLE * 3600000);

  if (idleRules.length === 0 && idlePrinters.length === 0) {
    return { organization_id, skipped: "no_alerts" };
  }

  // Dedup por día
  const today = new Date().toISOString().slice(0, 10);
  const targets = [
    ...idleRules.map((x) => ({ target_kind: "rule" as const, target_id: x.rule.id })),
    ...idlePrinters.map((x) => ({ target_kind: "printer" as const, target_id: x.printer.id })),
  ];
  const { data: alreadyNotified } = await supabase
    .from("routing_alert_notifications")
    .select("target_kind, target_id")
    .eq("organization_id", organization_id)
    .eq("notified_on", today);
  const sent = new Set((alreadyNotified ?? []).map((r: any) => `${r.target_kind}:${r.target_id}`));
  const newTargets = targets.filter((t) => !sent.has(`${t.target_kind}:${t.target_id}`));
  if (newTargets.length === 0) return { organization_id, skipped: "already_notified_today" };

  // Construir resumen
  const describeRule = (r: Rule) => {
    if (r.product_id) return `Producto: ${products.get(r.product_id) ?? r.product_id}`;
    if (r.category_id) return `Categoria: ${categories.get(r.category_id) ?? r.category_id}`;
    if (r.kitchen_station_id) return `Estacion: ${stations.get(r.kitchen_station_id) ?? r.kitchen_station_id}`;
    return "—";
  };
  const ruleLines = idleRules
    .filter((x) => !sent.has(`rule:${x.rule.id}`))
    .map((x) => `- ${describeRule(x.rule)} → ${printers.find((p) => p.id === x.rule.printer_id)?.name ?? "—"}`);
  const printerLines = idlePrinters
    .filter((x) => !sent.has(`printer:${x.printer.id}`))
    .map((x) => `- ${x.printer.name}${x.printer.role ? ` (${x.printer.role})` : ""}`);

  const summary =
`Alertas de enrutamiento SistecPOS

Organizacion: ${org.name}
Reglas sin uso (>=${DAYS_RULE_IDLE}d): ${ruleLines.length}
${ruleLines.join("\n")}

Impresoras inactivas (>=${HOURS_PRINTER_IDLE}h): ${printerLines.length}
${printerLines.join("\n")}

Revisar y silenciar: ${DASHBOARD_URL}`;

  // Destinatarios: owner/admin de la org
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, is_active, role")
    .eq("organization_id", organization_id)
    .eq("is_active", true)
    .in("role", ["owner", "admin"]);

  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const m of (members ?? [])) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
      if (u?.user?.email) emails.add(u.user.email);
      const { data: prof } = await supabase.from("profiles").select("phone").eq("user_id", m.user_id).maybeSingle();
      if (prof?.phone) phones.add(prof.phone);
    } catch (_) { /* skip */ }
  }
  if (emails.size === 0 && org.support_email) emails.add(org.support_email);
  if (phones.size === 0 && org.whatsapp_phone) phones.add(org.whatsapp_phone);

  const tasks: Promise<unknown>[] = [];
  for (const email of emails) {
    tasks.push(
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "generic-alert",
          recipientEmail: email,
          idempotencyKey: `routing-alerts-${organization_id}-${today}-${email}`,
          templateData: {
            org_name: org.name,
            subject: "Alertas de enrutamiento de impresion",
            body_text: summary,
            cta_url: DASHBOARD_URL,
            cta_label: "Abrir panel",
          },
        },
      }).catch((e) => console.error("email_failed", email, e?.message))
    );
  }
  for (const phone of phones) {
    tasks.push(
      supabase.functions.invoke("send-ycloud-whatsapp", {
        body: { action: "send_text", to: phone, message: summary, organization_id },
      }).catch((e) => console.error("whatsapp_failed", phone, e?.message))
    );
  }
  await Promise.allSettled(tasks);

  // Log dedupe rows
  const channel = emails.size > 0 && phones.size > 0 ? "both" : emails.size > 0 ? "email" : "whatsapp";
  const recipients_count = emails.size + phones.size;
  if (recipients_count > 0) {
    const rows = newTargets.map((t) => ({
      organization_id,
      target_kind: t.target_kind,
      target_id: t.target_id,
      notified_on: today,
      channel,
      recipients_count,
      payload: { rule_count: ruleLines.length, printer_count: printerLines.length },
    }));
    await supabase.from("routing_alert_notifications").upsert(rows, {
      onConflict: "organization_id,target_kind,target_id,notified_on",
    });
  }

  return {
    organization_id,
    rules_alerted: ruleLines.length,
    printers_alerted: printerLines.length,
    emails: emails.size,
    whatsapps: phones.size,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const organization_id: string | undefined = body?.organization_id;

    let orgIds: string[] = [];
    if (organization_id) {
      orgIds = [organization_id];
    } else {
      const { data } = await supabase.from("organizations").select("id").eq("is_active", true);
      orgIds = (data ?? []).map((o: any) => o.id);
    }

    const results = [];
    for (const id of orgIds) {
      try { results.push(await notifyOrg(supabase, id)); }
      catch (e) { results.push({ organization_id: id, error: (e as Error).message }); }
    }

    return new Response(JSON.stringify({ ok: true, processed: orgIds.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-routing-alerts error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
