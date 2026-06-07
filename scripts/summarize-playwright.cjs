#!/usr/bin/env node
/* eslint-disable */
/**
 * Lee playwright-report/results.json y emite:
 *   - Resumen markdown con tests fallidos + flakey (con motivo y % de fallos)
 *     en $GITHUB_STEP_SUMMARY y en playwright-report/pr-comment.md.
 *   - Archivo playwright-report/flaky.json con la lista de flakey detectados,
 *     consumido por el workflow para etiquetar el PR como "flaky".
 *
 * Definición de flakey: un test cuyo último intento es `passed` pero tuvo
 * 1+ intentos previos con status `failed` o `timedOut` (Playwright también
 * marca status = "flaky" cuando reintenta y termina pasando — lo cubrimos).
 */
const fs = require("fs");
const path = require("path");

const REPORT = path.join("playwright-report", "results.json");
const {
  GITHUB_SERVER_URL = "https://github.com",
  GITHUB_REPOSITORY = "",
  GITHUB_RUN_ID = "",
  GITHUB_SHA = "",
} = process.env;

const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const artifactsUrl = `${runUrl}#artifacts`;

function collect(suite, failed = [], flaky = [], stats = { total: 0 }) {
  for (const s of suite.suites ?? []) collect(s, failed, flaky, stats);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const results = t.results ?? [];
      if (results.length === 0) continue;
      stats.total += 1;
      const last = results[results.length - 1];
      const attemptsFailed = results.filter(
        (r) => r.status === "failed" || r.status === "timedOut",
      ).length;
      const firstError =
        (results.find((r) => r.error?.message)?.error?.message || "")
          .split("\n")[0];

      const isFlaky =
        t.status === "flaky" ||
        (last.status === "passed" && attemptsFailed > 0);

      if (isFlaky) {
        flaky.push({
          file: spec.file,
          line: spec.line,
          title: spec.title,
          project: t.projectName,
          attempts: results.length,
          failedAttempts: attemptsFailed,
          failureRate: Math.round((attemptsFailed / results.length) * 100),
          reason: firstError,
        });
        continue;
      }

      if (last.status === "passed" || last.status === "skipped") continue;
      failed.push({
        file: spec.file,
        line: spec.line,
        title: spec.title,
        project: t.projectName,
        status: last.status,
        error: (last.error?.message || "").split("\n")[0],
      });
    }
  }
  return { failed, flaky, stats };
}

if (!fs.existsSync(REPORT)) {
  console.log("No report found.");
  process.exit(0);
}
const data = JSON.parse(fs.readFileSync(REPORT, "utf8"));
const failed = [];
const flaky = [];
const stats = { total: 0 };
for (const s of data.suites ?? []) collect(s, failed, flaky, stats);

const flakyPct = stats.total
  ? Math.round((flaky.length / stats.total) * 100)
  : 0;

let headline;
if (failed.length > 0) {
  headline = `${failed.length} fallido(s)`;
} else if (flaky.length > 0) {
  headline = `passed con ${flaky.length} flakey (${flakyPct}%)`;
} else {
  headline = "passed";
}

let md = `### Playwright e2e — ${headline}\n\n`;
md += `Run: ${runUrl}\n`;
if (GITHUB_SHA) md += `Commit: \`${GITHUB_SHA.slice(0, 7)}\`\n`;
md += `\n`;

if (failed.length > 0) {
  md += `#### Fallos\n\n`;
  md += `| Test | Archivo | Estado | Error |\n|---|---|---|---|\n`;
  for (const f of failed) {
    md += `| ${f.title} | \`${f.file}:${f.line}\` | ${f.status} | ${(f.error || "").replace(/\|/g, "\\|").slice(0, 160)} |\n`;
  }
  md += `\nArtifacts (trace / video / screenshot): ${artifactsUrl}\n`;
  md += `\n> Abre el trace localmente: \`npx playwright show-trace <ruta-del-zip>\`\n\n`;
}

if (flaky.length > 0) {
  md += `#### Flakey (pasaron tras reintentar)\n\n`;
  md += `${flaky.length} de ${stats.total} tests inestables — **${flakyPct}%** del suite.\n\n`;
  md += `| Test | Archivo | Intentos | % Fallos | Motivo |\n|---|---|---|---|---|\n`;
  for (const f of flaky) {
    md += `| ${f.title} | \`${f.file}:${f.line}\` | ${f.failedAttempts}/${f.attempts} | ${f.failureRate}% | ${(f.reason || "—").replace(/\|/g, "\\|").slice(0, 160)} |\n`;
  }
  md += `\n> Solo se reintentan los casos inestables (config: \`retries: 2\` en CI). Revisa el trace del primer intento para reproducir.\n`;
}

if (failed.length === 0 && flaky.length === 0) {
  md += `Sin fallos ni flakey.\n`;
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) fs.appendFileSync(summaryPath, md + "\n");
fs.writeFileSync("playwright-report/pr-comment.md", md);
fs.writeFileSync(
  "playwright-report/flaky.json",
  JSON.stringify({ count: flaky.length, total: stats.total, percent: flakyPct, items: flaky }, null, 2),
);
process.stdout.write(md);
