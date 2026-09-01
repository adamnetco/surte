#!/usr/bin/env node
/**
 * Presupuesto de rendimiento (CI).
 *
 * Mide el peso real del bundle producido por `vite build` y falla si supera el
 * presupuesto declarado en `perf-budget.json`. Es la primera barrera del
 * presupuesto de rendimiento del POS: el LCP se degrada casi linealmente con el
 * JS de arranque, así que este gate previene regresiones antes de medir en el
 * navegador.
 *
 * Uso:
 *   node scripts/perf-budget.mjs            # falla si excede
 *   node scripts/perf-budget.mjs --update   # reescribe el baseline
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
const BUDGET_FILE = "perf-budget.json";
const KB = 1024;

if (!existsSync(DIST)) {
  console.error(`[perf-budget] No existe ./${DIST}. Ejecuta \`npm run build\` primero.`);
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const files = walk(DIST);
const gzipOf = (p) => gzipSync(readFileSync(p)).length;

let jsGz = 0;
let cssGz = 0;
let largestJs = { file: "", gz: 0 };

for (const f of files) {
  const ext = extname(f);
  if (ext === ".js" || ext === ".mjs") {
    const gz = gzipOf(f);
    jsGz += gz;
    if (gz > largestJs.gz) largestJs = { file: f, gz };
  } else if (ext === ".css") {
    cssGz += gzipOf(f);
  }
}

const totalBytes = files.reduce((acc, f) => acc + statSync(f).size, 0);

const actual = {
  totalJsGzipKb: +(jsGz / KB).toFixed(1),
  totalCssGzipKb: +(cssGz / KB).toFixed(1),
  largestJsChunkGzipKb: +(largestJs.gz / KB).toFixed(1),
  distRawMb: +(totalBytes / KB / KB).toFixed(2),
};

const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));

if (process.argv.includes("--update")) {
  const next = { ...budget, budgets: { ...budget.budgets, ...actual } };
  writeFileSync(BUDGET_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log("[perf-budget] Baseline actualizado:", actual);
  process.exit(0);
}

const rows = Object.entries(actual).map(([key, value]) => {
  const limit = budget.budgets[key];
  const over = typeof limit === "number" && value > limit;
  return { key, value, limit, over };
});

console.log("\n[perf-budget] Resultado del build\n");
for (const r of rows) {
  const flag = r.over ? "FAIL" : "ok  ";
  console.log(`  ${flag}  ${r.key.padEnd(24)} ${String(r.value).padStart(8)}  (límite ${r.limit})`);
}
console.log(`\n  chunk JS más grande: ${largestJs.file}\n`);

const failures = rows.filter((r) => r.over);
if (failures.length) {
  console.error(
    `[perf-budget] Presupuesto excedido en ${failures.length} métrica(s). ` +
      "Divide el chunk con import() dinámico o sube el límite justificándolo en " +
      "docs/desktop/perf-budget.md.",
  );
  process.exit(1);
}
console.log("[perf-budget] Dentro del presupuesto.");
