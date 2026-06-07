#!/usr/bin/env node
/* eslint-disable */
/**
 * Gate del nightly de @flaky.
 *
 * Lee playwright-report/flaky.json (lo escribe summarize-playwright.cjs)
 * y falla el job si:
 *   - El % de tests del suite marcados como flakey supera
 *     FLAKY_FAILURE_THRESHOLD (default 30%), o
 *   - Algún test individual tuvo un % de intentos fallidos por encima de
 *     FLAKY_PER_TEST_THRESHOLD (default 60%).
 *
 * Cuando falla, también añade una sección al GITHUB_STEP_SUMMARY para
 * que el motivo quede a la vista sin abrir logs.
 */
const fs = require("fs");
const path = require("path");

const REPORT = path.join("playwright-report", "flaky.json");
const SUITE_THRESHOLD = Number(process.env.FLAKY_FAILURE_THRESHOLD ?? "30");
const PER_TEST_THRESHOLD = Number(process.env.FLAKY_PER_TEST_THRESHOLD ?? "60");

if (!fs.existsSync(REPORT)) {
  console.log("flaky.json no encontrado — nada que evaluar.");
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(REPORT, "utf8"));
const suitePct = Number(data.percent ?? 0);
const items = Array.isArray(data.items) ? data.items : [];
const offenders = items.filter(
  (it) => Number(it.failureRate ?? 0) > PER_TEST_THRESHOLD,
);

const suiteExceeded = suitePct > SUITE_THRESHOLD;
const perTestExceeded = offenders.length > 0;

let md = `### Flaky threshold gate\n\n`;
md += `- Suite flakey: **${suitePct}%** (umbral ${SUITE_THRESHOLD}%)\n`;
md += `- Tests sobre umbral individual (> ${PER_TEST_THRESHOLD}% fallos): **${offenders.length}**\n\n`;

if (perTestExceeded) {
  md += `| Test | Archivo | % Fallos | Intentos | Motivo |\n|---|---|---|---|---|\n`;
  for (const o of offenders) {
    md += `| ${o.title} | \`${o.file}:${o.line}\` | ${o.failureRate}% | ${o.failedAttempts}/${o.attempts} | ${(o.reason || "—").replace(/\|/g, "\\|").slice(0, 160)} |\n`;
  }
  md += `\n`;
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) fs.appendFileSync(summaryPath, md + "\n");
process.stdout.write(md);

if (suiteExceeded || perTestExceeded) {
  const reasons = [];
  if (suiteExceeded)
    reasons.push(`suite ${suitePct}% > ${SUITE_THRESHOLD}%`);
  if (perTestExceeded)
    reasons.push(`${offenders.length} test(s) > ${PER_TEST_THRESHOLD}%`);
  console.error(`Flaky threshold exceeded: ${reasons.join(" · ")}`);
  process.exit(1);
}

console.log("Flaky bajo umbral — OK.");
