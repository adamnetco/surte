/**
 * E2E Tenant Isolation Smoke Test (Etapa 16)
 *
 * Para cada par (orgA_user, orgB_user) verifica que un usuario autenticado
 * en la org A no pueda leer ni mutar datos de la org B.
 *
 * USO:
 *   bun run scripts/e2e-tenant-isolation.ts \
 *     --emailA=ownerA@test.com --passA=... \
 *     --emailB=ownerB@test.com --passB=...
 *
 * Variables de entorno requeridas:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Tablas auditadas (representativas de cada dominio):
 *   - products, orders, categories, customer_reviews, banners
 *   - dining_tables, kds_tickets, cash_sessions, suppliers
 *   - landing_pages, featured_sections, kitchen_stations
 */
import { createClient } from "@supabase/supabase-js";

type Args = { emailA?: string; passA?: string; emailB?: string; passB?: string };
const args: Args = {};
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, "").split("=");
  (args as any)[k] = v;
}
if (!args.emailA || !args.passA || !args.emailB || !args.passB) {
  console.error("Faltan --emailA --passA --emailB --passB");
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const TABLES = [
  "products", "orders", "categories", "customer_reviews", "banners",
  "dining_tables", "kds_tickets", "cash_sessions", "suppliers",
  "landing_pages", "featured_sections", "kitchen_stations",
  "modifier_groups", "product_presentations", "warehouses", "purchase_orders",
];

async function login(email: string, password: string) {
  const client = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`login failed for ${email}: ${error?.message}`);
  // resolve primary org
  const { data: m } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!m) throw new Error(`no org membership for ${email}`);
  return { client, userId: data.user.id, orgId: m.organization_id as string };
}

async function tableLeakCount(client: any, table: string, otherOrgId: string) {
  const { data, error } = await client
    .from(table)
    .select("id, organization_id")
    .eq("organization_id", otherOrgId)
    .limit(5);
  return { rows: data?.length ?? 0, error: error?.message ?? null };
}

(async () => {
  console.log("→ Login A");
  const A = await login(args.emailA!, args.passA!);
  console.log("   orgA =", A.orgId);
  console.log("→ Login B");
  const B = await login(args.emailB!, args.passB!);
  console.log("   orgB =", B.orgId);

  if (A.orgId === B.orgId) {
    console.error("⚠️  Ambos usuarios pertenecen a la misma org. Usa cuentas distintas.");
    process.exit(1);
  }

  let leaks = 0;
  console.log("\n=== A intenta leer datos de B ===");
  for (const t of TABLES) {
    const r = await tableLeakCount(A.client, t, B.orgId);
    if (r.rows > 0) {
      console.error(`❌ LEAK ${t}: A leyó ${r.rows} filas de B`);
      leaks++;
    } else {
      console.log(`✅ ${t}: 0 filas visibles${r.error ? ` (err: ${r.error.slice(0,60)})` : ""}`);
    }
  }
  console.log("\n=== B intenta leer datos de A ===");
  for (const t of TABLES) {
    const r = await tableLeakCount(B.client, t, A.orgId);
    if (r.rows > 0) {
      console.error(`❌ LEAK ${t}: B leyó ${r.rows} filas de A`);
      leaks++;
    } else {
      console.log(`✅ ${t}: 0 filas visibles${r.error ? ` (err: ${r.error.slice(0,60)})` : ""}`);
    }
  }

  // Edge function test: A intenta enviar push a org B
  console.log("\n=== A intenta send-web-push para org B ===");
  const { data: pushRes, error: pushErr } = await A.client.functions.invoke("send-web-push", {
    body: { title: "leak-test", body: "x", organization_id: B.orgId, segment: "all" },
  });
  if (pushErr || (pushRes && (pushRes as any).error)) {
    console.log("✅ send-web-push rechazado:", (pushErr as any)?.message ?? (pushRes as any).error);
  } else {
    console.error("❌ LEAK send-web-push aceptó org ajena:", pushRes);
    leaks++;
  }

  // Edge function: broadcast-whatsapp-ycloud cross-tenant
  console.log("\n=== A intenta broadcast-whatsapp-ycloud para org B ===");
  const { data: bwRes, error: bwErr } = await A.client.functions.invoke("broadcast-whatsapp-ycloud", {
    body: { action: "preview_audience", organization_id: B.orgId, segment: "all" },
  });
  if (bwErr || (bwRes && (bwRes as any).error)) {
    console.log("✅ broadcast-whatsapp rechazado:", (bwErr as any)?.message ?? (bwRes as any).error);
  } else {
    console.error("❌ LEAK broadcast-whatsapp aceptó org ajena:", bwRes);
    leaks++;
  }

  // Edge function: sync-outbox-retry — A intenta resetear un outbox de B (id ficticio,
  // pero el control de acceso debe rechazar ANTES de validar existencia).
  console.log("\n=== A intenta sync-outbox-retry sobre fila de B ===");
  const { data: outRow } = await B.client
    .from("sync_outbox")
    .select("id")
    .eq("organization_id", B.orgId)
    .limit(1)
    .maybeSingle();
  if (outRow?.id) {
    const { data: retryRes, error: retryErr } = await A.client.functions.invoke("sync-outbox-retry", {
      body: { id: outRow.id },
    });
    if (retryErr || (retryRes && (retryRes as any).error)) {
      console.log("✅ sync-outbox-retry rechazado:", (retryErr as any)?.message ?? (retryRes as any).error);
    } else {
      console.error("❌ LEAK sync-outbox-retry aceptó fila ajena:", retryRes);
      leaks++;
    }
  } else {
    console.log("ℹ️  Sin filas sync_outbox en org B para probar retry");
  }

  // Etapa 22: cloudflare-domain-status sobre hostname de B
  console.log("\n=== A intenta cloudflare-domain-status para hostname de B ===");
  const { data: domB } = await B.client
    .from("tenant_domains").select("hostname").eq("organization_id", B.orgId).limit(1).maybeSingle();
  if (domB?.hostname) {
    const { data: cfRes, error: cfErr } = await A.client.functions.invoke("cloudflare-domain-status", {
      body: { hostname: domB.hostname },
    });
    if (cfErr || (cfRes && (cfRes as any).error)) {
      console.log("✅ cloudflare-domain-status rechazado:", (cfErr as any)?.message ?? (cfRes as any).error);
    } else {
      console.error("❌ LEAK cloudflare-domain-status aceptó hostname ajeno:", cfRes);
      leaks++;
    }
  } else {
    console.log("ℹ️  Sin tenant_domains en org B");
  }

  // Etapa 22: verify-tenant-domain sobre domain_id de B
  console.log("\n=== A intenta verify-tenant-domain sobre domain_id de B ===");
  const { data: domIdB } = await B.client
    .from("tenant_domains").select("id").eq("organization_id", B.orgId).limit(1).maybeSingle();
  if (domIdB?.id) {
    const { data: vRes, error: vErr } = await A.client.functions.invoke("verify-tenant-domain", {
      body: { domain_id: domIdB.id },
    });
    if (vErr || (vRes && (vRes as any).error)) {
      console.log("✅ verify-tenant-domain rechazado:", (vErr as any)?.message ?? (vRes as any).error);
    } else {
      console.error("❌ LEAK verify-tenant-domain aceptó dominio ajeno:", vRes);
      leaks++;
    }
  } else {
    console.log("ℹ️  Sin tenant_domains en org B");
  }

  // Etapa 22: send-whatsapp-order sin JWT debe ser rechazado
  console.log("\n=== Anónimo intenta send-whatsapp-order ===");
  const anonClient = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const { data: woRes, error: woErr } = await anonClient.functions.invoke("send-whatsapp-order", {
    body: { items: [{ name: "x", price: 1, quantity: 1 }], customer_name: "x", customer_phone: "3000000000" },
  });
  if (woErr || (woRes && (woRes as any).error)) {
    console.log("✅ send-whatsapp-order rechazado:", (woErr as any)?.message ?? (woRes as any).error);
  } else {
    console.error("❌ LEAK send-whatsapp-order aceptó request anónimo:", woRes);
    leaks++;
  }

  // Etapa 22: optimize-image sin JWT debe ser rechazado
  console.log("\n=== Anónimo intenta optimize-image ===");
  const { data: oiRes, error: oiErr } = await anonClient.functions.invoke("optimize-image", {
    body: { imageUrl: "https://example.com/x.jpg", bucket: "secrets", path: "../../etc/passwd" },
  });
  if (oiErr || (oiRes && (oiRes as any).error)) {
    console.log("✅ optimize-image rechazado:", (oiErr as any)?.message ?? (oiRes as any).error);
  } else {
    console.error("❌ LEAK optimize-image aceptó request anónimo:", oiRes);
    leaks++;
  }

  console.log(`\n────── RESULT: ${leaks === 0 ? "✅ ISOLATION OK" : `❌ ${leaks} LEAKS`}`);
  process.exit(leaks === 0 ? 0 : 1);
})();
