/**
 * Cloud Tasks registry & checkers.
 *
 * Source-of-truth list of pending Lovable Cloud tasks (migration, seeds, secrets,
 * edge functions, UI, dominios) y verificadores ligeros que consultan Test y Live
 * para saber si ya fueron ejecutadas.
 *
 * Diseño: 100% frontend. Cada checker devuelve un estado por entorno con manejo
 * defensivo (backend caído ⇒ "unknown", no rompe la UI). El historial vive en
 * localStorage para no depender del backend mientras está inestable.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PublicTable = keyof Database["public"]["Tables"];

export type EnvKey = "test" | "live";
export type TaskStatus = "done" | "pending" | "partial" | "error" | "unknown";

export interface EnvResult {
  status: TaskStatus;
  detail: string;
  checkedAt: string; // ISO
}

export interface CloudTask {
  id: string;
  group: "migration" | "seed" | "secret" | "edge_function" | "ui" | "domain";
  title: string;
  description: string;
  /** Lee el archivo .lovable/pending-cloud-tasks.md para ver SQL/instrucciones */
  reference?: string;
  /** Acción manual sugerida si el checker queda en pending. */
  howToRun?: string;
  /** Checker por entorno. */
  check: (env: EnvKey) => Promise<EnvResult>;
}

// ---- helpers --------------------------------------------------------------

const now = () => new Date().toISOString();

/**
 * Live environment requires an alternate Supabase URL. Lovable inyecta
 * VITE_SUPABASE_URL para Test; para Live caemos al mismo cliente cuando no
 * hay distinción (status quedará marcado como "unknown" si la query falla).
 */
async function queryEnv<T>(
  env: EnvKey,
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  // Nota: el cliente actual solo apunta a Test. Para Live el dashboard sólo
  // mostrará "unknown" hasta que el usuario publique (entonces ambos entornos
  // comparten esquema). Aún así, intentamos la query y reportamos honestamente.
  if (env === "live") {
    // El cliente publishable de Lovable apunta a Test. Una llamada Live real
    // requeriría VITE_SUPABASE_LIVE_URL, que no existe aún. Marcamos unknown.
    return { ok: false, data: null, error: "Cliente Live no configurado (publica para sincronizar esquema)" };
  }
  try {
    const { data, error } = await fn();
    if (error) return { ok: false, data: null, error: error.message };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, data: null, error: e?.message ?? "Error de red" };
  }
}

async function checkColumnExists(env: EnvKey, table: PublicTable, column: string): Promise<EnvResult> {
  // Introspección: tabla viene tipada (keyof Tables) pero la columna es dinámica,
  // por lo que el builder no la puede validar en compile-time. Acotamos el cast
  // a la firma mínima necesaria en lugar de un `as any` global.
  const r = await queryEnv(env, async () =>
    (supabase.from(table) as unknown as { select: (c: string) => { limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }> } })
      .select(column)
      .limit(1),
  );
  if (r.ok) return { status: "done", detail: `Columna ${column} existe`, checkedAt: now() };
  if (r.error?.includes("does not exist") || r.error?.includes("column"))
    return { status: "pending", detail: `Falta columna ${column}`, checkedAt: now() };
  return { status: "unknown", detail: r.error ?? "Sin respuesta", checkedAt: now() };
}

async function checkTableExists(env: EnvKey, table: string): Promise<EnvResult> {
  // `table` puede no existir todavía: por eso aceptamos `string` y acotamos el
  // cast a la firma mínima.
  const r = await queryEnv(env, async () =>
    (supabase.from(table as PublicTable) as unknown as { select: (c: string) => { limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }> } })
      .select("id")
      .limit(1),
  );
  if (r.ok) return { status: "done", detail: `Tabla ${table} existe`, checkedAt: now() };
  if (r.error?.includes("does not exist") || r.error?.includes("relation"))
    return { status: "pending", detail: `Falta tabla ${table}`, checkedAt: now() };
  return { status: "unknown", detail: r.error ?? "Sin respuesta", checkedAt: now() };
}

async function checkOrgExists(env: EnvKey, slug: string): Promise<EnvResult> {
  const r = await queryEnv(env, async () =>
    supabase.from("organizations").select("id").eq("slug", slug).maybeSingle(),
  );
  if (r.ok && r.data) return { status: "done", detail: `Tenant "${slug}" presente`, checkedAt: now() };
  if (r.ok) return { status: "pending", detail: `Tenant "${slug}" no encontrado`, checkedAt: now() };
  return { status: "unknown", detail: r.error ?? "Sin respuesta", checkedAt: now() };
}

async function checkEdgeFunction(env: EnvKey, name: string): Promise<EnvResult> {
  if (env === "live") return { status: "unknown", detail: "Live se valida al publicar", checkedAt: now() };
  try {
    // OPTIONS preflight: la función responde si está desplegada (aun sin auth).
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
    const res = await fetch(url, { method: "OPTIONS" });
    if (res.status < 500) return { status: "done", detail: `Edge fn "${name}" desplegada`, checkedAt: now() };
    return { status: "pending", detail: `Sin respuesta (${res.status})`, checkedAt: now() };
  } catch (e: any) {
    return { status: "unknown", detail: e?.message ?? "Error de red", checkedAt: now() };
  }
}

// ---- registry -------------------------------------------------------------

export const CLOUD_TASKS: CloudTask[] = [
  {
    id: "mig-tenant-domains-cf",
    group: "migration",
    title: "Columnas Cloudflare en tenant_domains",
    description: "dns_mode, cf_zone_id, cf_account_id, cf_hostname_id, cf_ssl_status, cname_target, …",
    reference: ".lovable/pending-cloud-tasks.md §1.1",
    howToRun: "Lanzar supabase--migration con el SQL de la sección 1.1.",
    check: (env) => checkColumnExists(env, "tenant_domains", "dns_mode"),
  },
  {
    id: "mig-tenant-cloudflare-accounts",
    group: "migration",
    title: "Tabla tenant_cloudflare_accounts (multi-cuenta CF)",
    description: "Soporte para que cada org use su propia cuenta de Cloudflare.",
    reference: ".lovable/pending-cloud-tasks.md §1.2",
    howToRun: "Lanzar supabase--migration con el SQL de la sección 1.2 (incluye RLS).",
    check: (env) => checkTableExists(env, "tenant_cloudflare_accounts"),
  },
  {
    id: "seed-demo-tenant",
    group: "seed",
    title: "Tenant demo para vitrina pública",
    description: "Reemplaza la tienda real Surteya como ejemplo en LoginRouter.",
    reference: ".lovable/pending-cloud-tasks.md §2",
    howToRun: "Insertar organización slug='demo' en Test y Live (production).",
    check: (env) => checkOrgExists(env, "demo"),
  },
  {
    id: "secret-cf-api-token",
    group: "secret",
    title: "CLOUDFLARE_API_TOKEN",
    description: "Token global SaaS (Zone.SSL + Hostname + DNS).",
    reference: ".lovable/pending-cloud-tasks.md §3",
    howToRun: "Pedir al usuario vía secrets--add_secret.",
    check: async () => ({ status: "unknown", detail: "Validado al primer uso de la edge fn", checkedAt: now() }),
  },
  {
    id: "secret-cf-fallback-zone",
    group: "secret",
    title: "CLOUDFLARE_FALLBACK_ZONE_ID",
    description: "Zone por defecto para crear Custom Hostnames SaaS.",
    reference: ".lovable/pending-cloud-tasks.md §3",
    howToRun: "Pedir al usuario vía secrets--add_secret.",
    check: async () => ({ status: "unknown", detail: "Validado al primer uso de la edge fn", checkedAt: now() }),
  },
  {
    id: "edge-cf-domain-connect",
    group: "edge_function",
    title: "Edge fn cloudflare-domain-connect",
    description: "Crea Custom Hostname y persiste verificación DNS.",
    reference: ".lovable/pending-cloud-tasks.md §4",
    howToRun: "Crear archivo y supabase--deploy_edge_functions.",
    check: (env) => checkEdgeFunction(env, "cloudflare-domain-connect"),
  },
  {
    id: "edge-cf-domain-status",
    group: "edge_function",
    title: "Edge fn cloudflare-domain-status",
    description: "Polling de SSL/DCV en Cloudflare.",
    reference: ".lovable/pending-cloud-tasks.md §4",
    howToRun: "Crear archivo y supabase--deploy_edge_functions.",
    check: (env) => checkEdgeFunction(env, "cloudflare-domain-status"),
  },
  {
    id: "ui-sitios-wizard",
    group: "ui",
    title: "Wizard de dominios en Sitios.tsx",
    description: "3 pasos: dominio → CNAME/TXT → verificación + barra SSL.",
    reference: ".lovable/pending-cloud-tasks.md §5",
    howToRun: "Editar src/modules/superadmin/pages/Sitios.tsx.",
    check: async () => ({ status: "unknown", detail: "Verificar manualmente en /sitios", checkedAt: now() }),
  },
  {
    id: "domain-demo-dns-acme",
    group: "domain",
    title: "DNS pendiente del cliente — demo.sistecpos.com",
    description:
      "Publicar TXT _acme-challenge.demo.sistecpos.com (2 registros) + A demo → 185.158.133.1. Se marca efectuado cuando cf_ssl_status='active'.",
    reference: ".lovable/pending-cloud-tasks.md §7b",
    howToRun:
      "El cliente edita su DNS. Ver TXT exactos en /superadmin/sitios → demo → Reprovisionar.",
    check: (env) =>
      queryEnv(env, async () =>
        supabase
          .from("tenant_domains")
          .select("cf_ssl_status,cf_status")
          .eq("hostname", "demo.sistecpos.com")
          .maybeSingle(),
      ).then<EnvResult>((r) => {
        if (!r.ok) return { status: "unknown", detail: r.error ?? "Sin respuesta", checkedAt: now() };
        if (!r.data) return { status: "pending", detail: "Dominio no registrado aún", checkedAt: now() };
        const ssl = r.data.cf_ssl_status;
        if (ssl === "active") return { status: "done", detail: "SSL activo — DNS publicado por el cliente", checkedAt: now() };
        return { status: "pending", detail: `SSL: ${ssl ?? "n/a"} — esperando TXT/A del cliente`, checkedAt: now() };
      }),
  },
  {
    id: "domain-surteya",
    group: "domain",
    title: "Registro de surteya.com en Cloudflare",
    description: "Modo cloudflare_account, CNAME a proxy.sistecpos.com.",
    reference: ".lovable/pending-cloud-tasks.md §6",
    howToRun: "Crear fila en tenant_domains + tenant_cloudflare_accounts del cliente.",
    check: (env) =>
      queryEnv(env, async () =>
        supabase.from("tenant_domains").select("id").eq("hostname", "surteya.com").maybeSingle(),
      ).then<EnvResult>((r) => {
        if (r.ok && r.data) return { status: "done", detail: "Registrado", checkedAt: now() };
        if (r.ok) return { status: "pending", detail: "No registrado", checkedAt: now() };
        return { status: "unknown", detail: r.error ?? "Sin respuesta", checkedAt: now() };
      }),
  },
];

// ---- historial (localStorage) --------------------------------------------

const HISTORY_KEY = "sistecpos:cloud-tasks:history:v1";
const MAX_ENTRIES = 200;

export interface HistoryEntry {
  taskId: string;
  env: EnvKey;
  status: TaskStatus;
  detail: string;
  at: string;
}

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry) {
  const all = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
