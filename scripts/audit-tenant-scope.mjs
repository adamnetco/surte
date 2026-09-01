#!/usr/bin/env node
/**
 * Auditoría tenant-first (FASE 10).
 *
 * 1. Detecta `.select("*")` en código de negocio (src/, supabase/functions/).
 * 2. Detecta queries a tablas tenant-scoped sin `.eq("organization_id", ...)`
 *    en el mismo bloque de la cadena.
 *
 * Uso: node scripts/audit-tenant-scope.mjs [--json]
 * Salida: reporte legible + exit code 1 si hay hallazgos nuevos sobre baseline.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src", "supabase/functions"];
const EXT = /\.(ts|tsx)$/;

/** Tablas cuyo acceso SIEMPRE debe estar filtrado por organization_id. */
const TENANT_TABLES = [
  "products",
  "categories",
  "brands",
  "orders",
  "order_items",
  "pos_orders",
  "pos_order_items",
  "pos_payments",
  "cash_sessions",
  "cash_movements",
  "product_stock",
  "stock_movements",
  "warehouses",
  "suppliers",
  "purchase_orders",
  "electronic_invoices",
  "persistent_carts",
];

/** Hallazgos aceptados (públicos por diseño o ya filtrados vía RLS estricta). */
const BASELINE_SELECT_STAR = 40;

function walk(dir, out = []) {
  let entries;
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
    else if (EXT.test(entry)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
const selectStar = [];
const missingOrgFilter = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    if (/\.select\(\s*["'`]\*/.test(line)) {
      selectStar.push({ file: relative(process.cwd(), file), line: i + 1, code: line.trim() });
    }
  });

  for (const table of TENANT_TABLES) {
    const re = new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]`, "g");
    let m;
    while ((m = re.exec(src))) {
      // Ventana de 600 caracteres tras el .from(...) = la cadena de la query.
      const window = src.slice(m.index, m.index + 600);
      const hasOrg = /organization_id/.test(window);
      if (!hasOrg) {
        const line = src.slice(0, m.index).split("\n").length;
        missingOrgFilter.push({ file: relative(process.cwd(), file), line, table });
      }
    }
  }
}

const report = { selectStar, missingOrgFilter };

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n=== Auditoría tenant-first ===\nArchivos analizados: ${files.length}\n`);
  console.log(`.select("*"): ${selectStar.length} (baseline ${BASELINE_SELECT_STAR})`);
  for (const h of selectStar.slice(0, 30)) console.log(`  ${h.file}:${h.line}`);
  if (selectStar.length > 30) console.log(`  ... y ${selectStar.length - 30} más`);

  console.log(`\nQueries tenant sin organization_id: ${missingOrgFilter.length}`);
  const byTable = missingOrgFilter.reduce((acc, h) => {
    acc[h.table] = (acc[h.table] ?? 0) + 1;
    return acc;
  }, {});
  for (const [table, count] of Object.entries(byTable).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${table}: ${count}`);
  }
  console.log("");
}

if (selectStar.length > BASELINE_SELECT_STAR) {
  console.error(
    `❌ Regresión: ${selectStar.length} usos de select("*") supera el baseline ${BASELINE_SELECT_STAR}.`,
  );
  process.exit(1);
}
