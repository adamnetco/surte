/**
 * Etapa 5 — Auditoría refinada de aislamiento multi-tenant
 *
 * Mejoras vs. v1 (Etapa 1):
 *  - Detecta cadenas multilínea (file completo, no línea por línea) para evaluar
 *    si un `.from("tbl")` que termina en `.select(...)` realmente filtra por
 *    organization_id (sea con `.eq("organization_id", ...)` o `scopedFrom/scopedSelect`).
 *  - Whitelist de tablas globales (no multi-tenant): ej. `app_settings`,
 *    `saas_plans`, `modules`, `auth_*`, `desktop_releases`, `feature_flags`,
 *    `plan_modules`, `admin_section_access`, `municipality_settings`,
 *    `tenant_*`, `user_roles`, `categories` (cuando son globales),
 *    además de las propias `organizations` / `organization_members`.
 *  - Edge functions: sólo flagean si NO usan `service_role` o `req.headers`
 *    auth context (asumimos service_role admin context cuando hay
 *    SUPABASE_SERVICE_ROLE_KEY en el archivo).
 *  - Insert sin organization_id: ignora tablas globales y operaciones donde
 *    el spread `...payload` ya incluye organization_id (heurística).
 *  - Salida con ranking de archivos peor evaluados y resumen ejecutivo.
 *
 * Uso:  bun scripts/audit-tenant-scope.ts > docs/audit/tenant-scope-$(date +%F).md
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = ["src", "supabase/functions"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** Tablas que NO son multi-tenant (globales o gestionadas por superadmin). */
const GLOBAL_TABLES = new Set([
  "saas_plans",
  "modules",
  "plan_modules",
  "feature_flags",
  "desktop_releases",
  "admin_section_access",
  "user_roles",
  "auth_settings",
  "auth_factors",
  "auth_login_events",
  "auth_recovery_codes",
  "auth_webauthn_credentials",
  "auth_superadmin_allowlist",
  "auth_break_glass_requests",
  "tenant_sites",
  "tenant_domains",
  "tenant_wp_config",
  "tenant_cloudflare_accounts",
  "tenant_sync_log",
  "organizations",
  "organization_members",
  "organization_modules",
  "leads_trials",
  "org_signup_requests",
  "crm_leads",
  "suppressed_emails",
  "email_unsubscribe_tokens",
  "email_send_log",
  "email_send_state",
  "sso_handoff_tokens",
  "client_downloads",
  "support_subscriptions",
  "subscription_invoices",
  "subscriptions",
  "license_audit",
]);

interface Hit {
  file: string;
  line: number;
  rule: string;
  severity: "high" | "medium" | "low";
  table?: string;
  snippet: string;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(full.slice(full.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

/**
 * Analiza una "cadena" de query Supabase a partir de la posición de un
 * `.from("tbl")`. Recoge hasta 600 chars / 25 líneas hacia adelante y se
 * detiene en un `;` o cierre de paréntesis balanceado a nivel superior.
 */
function extractChain(src: string, fromIndex: number): string {
  const slice = src.slice(fromIndex, fromIndex + 900);
  // cortar en el primer ; de top-level
  let depth = 0;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === ";" && depth <= 0) return slice.slice(0, i);
    else if (c === "\n" && depth <= 0 && i > 80 && slice[i + 1] !== "." && !/\s*\./.test(slice.slice(i, i + 6))) {
      return slice.slice(0, i);
    }
  }
  return slice;
}

const FROM_RE = /supabase\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g;
const HARDCODED_SURTEYA = /['"`]surteya['"`]/i;
const DEFAULT_ORG = /default_org_id\s*\(/;

const hits: Hit[] = [];
const files = TARGETS.flatMap((t) => walk(join(ROOT, t)));

for (const file of files) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const isEdge = rel.startsWith("supabase/functions/");
  const isServiceRole = isEdge && /SUPABASE_SERVICE_ROLE_KEY/.test(src);
  const isAuthOrSuper =
    rel.includes("/auth/") || rel.includes("/superadmin/") || rel.includes("/platform/");
  const skipFile =
    rel.includes("/integrations/supabase/") ||
    rel.includes("/modules/tenant/lib/tenantScope") ||
    rel.endsWith(".test.ts") ||
    rel.endsWith(".test.tsx");

  if (skipFile) continue;

  // line index
  const lineStarts: number[] = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (pos: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };

  // 1. hardcoded slug + default_org_id
  src.split("\n").forEach((line, i) => {
    if (HARDCODED_SURTEYA.test(line) && !/legacy|deprecated|comment|\/\//i.test(line.slice(0, 40))) {
      hits.push({
        file: rel, line: i + 1, severity: "high",
        rule: "hardcoded 'surteya' slug", snippet: line.trim().slice(0, 140),
      });
    }
    if (DEFAULT_ORG.test(line)) {
      hits.push({
        file: rel, line: i + 1, severity: "high",
        rule: "uses default_org_id() (deprecated)", snippet: line.trim().slice(0, 140),
      });
    }
  });

  // 2. cadenas .from()
  let m: RegExpExecArray | null;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(src))) {
    const table = m[1];
    const pos = m.index;
    const line = lineOf(pos);
    const chain = extractChain(src, pos);
    const isGlobal = GLOBAL_TABLES.has(table);
    const usesScopedFrom = /scopedFrom|scopedSelect/.test(src.slice(Math.max(0, pos - 60), pos));
    // Look-back: organization_id assignment in same scope (≤ 600 chars before .from)
    const lookback = src.slice(Math.max(0, pos - 600), pos);
    const orgInScope =
      /organization_id\s*[:=]/.test(lookback) ||
      /\.eq\(\s*['"`]organization_id['"`]/.test(lookback);
    const filtersOrg =
      /\.eq\(\s*['"`]organization_id['"`]/.test(chain) ||
      /organization_id\s*:/.test(chain) ||
      orgInScope;
    const isInsert = /\.insert\(/.test(chain);
    const isSelect = /\.select\(/.test(chain) && !isInsert;
    const isUpdateOrDelete = /\.update\(|\.delete\(/.test(chain) && !isSelect;

    if (isGlobal || usesScopedFrom) continue;

    // SELECT sin filtro de organization_id (alto si no es auth/super)
    if (isSelect && !filtersOrg) {
      // ignorar selects encadenados por id único (.eq("id", ...))
      const byUniqueId = /\.eq\(\s*['"`]id['"`]\s*,/.test(chain);
      if (!byUniqueId) {
        hits.push({
          file: rel, line, severity: isAuthOrSuper ? "low" : "high",
          table,
          rule: "select() without organization_id filter",
          snippet: chain.replace(/\s+/g, " ").slice(0, 160),
        });
      }
    }

    // INSERT sin organization_id (sólo si la tabla es multi-tenant y no service_role)
    if (isInsert && !filtersOrg && !isServiceRole) {
      hits.push({
        file: rel, line, severity: "high",
        table,
        rule: "insert() without organization_id",
        snippet: chain.replace(/\s+/g, " ").slice(0, 160),
      });
    }

    // UPDATE/DELETE: si filtra sólo por columna no-id (no por id ni org), warn medium
    if (isUpdateOrDelete && !filtersOrg) {
      const byUniqueId = /\.eq\(\s*['"`]id['"`]\s*,/.test(chain);
      if (!byUniqueId) {
        hits.push({
          file: rel, line, severity: "medium",
          table,
          rule: "update/delete without id nor organization_id filter",
          snippet: chain.replace(/\s+/g, " ").slice(0, 160),
        });
      }
    }
  }
}

// --- Reporte ---
const bySev = { high: [] as Hit[], medium: [] as Hit[], low: [] as Hit[] };
for (const h of hits) bySev[h.severity].push(h);

const fileScore = new Map<string, number>();
for (const h of hits) {
  const w = h.severity === "high" ? 5 : h.severity === "medium" ? 2 : 1;
  fileScore.set(h.file, (fileScore.get(h.file) ?? 0) + w);
}
const topOffenders = [...fileScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

const tableHits = new Map<string, number>();
for (const h of hits) if (h.table) tableHits.set(h.table, (tableHits.get(h.table) ?? 0) + 1);
const topTables = [...tableHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

const today = new Date().toISOString().slice(0, 10);
const out: string[] = [];
out.push(`# Auditoría tenant-scope (refinada) — ${today}\n`);
out.push(`Archivos escaneados: **${files.length}**  ·  Hallazgos: **${hits.length}**  `);
out.push(
  `(high: ${bySev.high.length}, medium: ${bySev.medium.length}, low: ${bySev.low.length})\n`,
);
out.push(`Generado por \`scripts/audit-tenant-scope.ts\` (Etapa 5).\n`);

out.push(`\n## Top archivos a refactorizar (peso = high·5 + medium·2 + low·1)\n`);
for (const [f, s] of topOffenders) out.push(`- **${s}** — \`${f}\``);

out.push(`\n## Tablas más expuestas\n`);
for (const [t, c] of topTables) out.push(`- ${c}× → \`${t}\``);

for (const sev of ["high", "medium", "low"] as const) {
  out.push(`\n## ${sev.toUpperCase()} (${bySev[sev].length})\n`);
  const byFile = new Map<string, Hit[]>();
  for (const h of bySev[sev]) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file)!.push(h);
  }
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [file, items] of sorted) {
    out.push(`\n### \`${file}\` (${items.length})`);
    for (const h of items.slice(0, 8)) {
      out.push(`- L${h.line} · ${h.rule}${h.table ? ` · \`${h.table}\`` : ""}`);
      out.push(`  \`\`\`${h.snippet.replace(/`/g, "\\`")}\`\`\``);
    }
    if (items.length > 8) out.push(`- _… +${items.length - 8} más_`);
  }
}

console.log(out.join("\n"));
