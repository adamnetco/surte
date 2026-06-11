/**
 * Etapa 1 — Auditoría de aislamiento multi-tenant
 *
 * Recorre src/ y supabase/functions/ buscando patrones que indiquen que el código
 * asume una sola organización (legado ecommerce). Genera un reporte markdown.
 *
 * Uso:  bun scripts/audit-tenant-scope.ts > docs/audit/tenant-scope-$(date +%F).md
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = ["src", "supabase/functions"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

interface Hit {
  file: string;
  line: number;
  rule: string;
  severity: "high" | "medium" | "low";
  snippet: string;
}

const RULES: Array<{
  rule: string;
  severity: Hit["severity"];
  test: (line: string) => boolean;
  skipIf?: (file: string, line: string) => boolean;
}> = [
  {
    rule: "uses default_org_id() (legacy single-tenant)",
    severity: "high",
    test: (l) => /default_org_id\s*\(/.test(l),
  },
  {
    rule: "hardcoded 'surteya' slug",
    severity: "high",
    test: (l) => /['"`]surteya['"`]/i.test(l),
    skipIf: (f) => f.includes("astro-starter") || f.endsWith(".test.ts"),
  },
  {
    rule: "supabase.from() without scoped wrapper (review)",
    severity: "medium",
    test: (l) => /supabase\.from\(\s*['"`]/.test(l) && !/scopedFrom|scopedSelect/.test(l),
    skipIf: (f) =>
      f.includes("/integrations/supabase/") ||
      f.includes("/modules/tenant/") ||
      f.includes("/auth/") ||
      f.includes("/superadmin/"),
  },
  {
    rule: "missing organization_id on .insert()",
    severity: "medium",
    test: (l) => /\.insert\(\{/.test(l) && !/organization_id/.test(l),
  },
  {
    rule: "TODO/FIXME tenant",
    severity: "low",
    test: (l) => /(TODO|FIXME|XXX).*(tenant|org|multi)/i.test(l),
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(full.slice(full.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

const hits: Hit[] = [];
const files = TARGETS.flatMap((t) => walk(join(ROOT, t)));

for (const file of files) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.skipIf?.(rel, line)) continue;
      if (r.test(line)) {
        hits.push({
          file: rel,
          line: i + 1,
          rule: r.rule,
          severity: r.severity,
          snippet: line.trim().slice(0, 140),
        });
      }
    }
  });
}

// Agrupar
const bySeverity = { high: [] as Hit[], medium: [] as Hit[], low: [] as Hit[] };
for (const h of hits) bySeverity[h.severity].push(h);

const today = new Date().toISOString().slice(0, 10);
const out: string[] = [];
out.push(`# Auditoría tenant-scope — ${today}\n`);
out.push(`Archivos escaneados: **${files.length}**  ·  Hallazgos: **${hits.length}**  `);
out.push(
  `(high: ${bySeverity.high.length}, medium: ${bySeverity.medium.length}, low: ${bySeverity.low.length})\n`,
);
out.push(`Generado por \`scripts/audit-tenant-scope.ts\` — Etapa 1 del refactor SaaS.\n`);

for (const sev of ["high", "medium", "low"] as const) {
  out.push(`\n## ${sev.toUpperCase()} (${bySeverity[sev].length})\n`);
  // agrupar por archivo
  const byFile = new Map<string, Hit[]>();
  for (const h of bySeverity[sev]) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file)!.push(h);
  }
  const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [file, items] of sorted) {
    out.push(`\n### \`${file}\` (${items.length})`);
    for (const h of items.slice(0, 10)) {
      out.push(`- L${h.line} · ${h.rule}`);
      out.push(`  \`\`\`${h.snippet.replace(/`/g, "\\`")}\`\`\``);
    }
    if (items.length > 10) out.push(`- _… +${items.length - 10} más_`);
  }
}

console.log(out.join("\n"));
