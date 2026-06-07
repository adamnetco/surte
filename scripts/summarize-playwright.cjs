#!/usr/bin/env node
/* eslint-disable */
/**
 * Lee playwright-report/results.json y emite un resumen markdown con los
 * tests fallidos + links al run y a los artifacts (trace/video). Lo escribe
 * en $GITHUB_STEP_SUMMARY y en stdout (para que un step posterior lo use
 * como cuerpo de comentario en el PR).
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

function collect(suite, acc = []) {
  for (const s of suite.suites ?? []) collect(s, acc);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const last = t.results?.[t.results.length - 1];
      if (!last || last.status === "passed" || last.status === "skipped") continue;
      acc.push({
        file: spec.file,
        line: spec.line,
        title: spec.title,
        project: t.projectName,
        status: last.status,
        error: (last.error?.message || "").split("\n")[0],
        attachments: (last.attachments || []).map((a) => a.name),
      });
    }
  }
  return acc;
}

if (!fs.existsSync(REPORT)) {
  console.log("No report found.");
  process.exit(0);
}
const data = JSON.parse(fs.readFileSync(REPORT, "utf8"));
const failed = [];
for (const s of data.suites ?? []) collect(s, failed);

let md = `### Playwright e2e — ${failed.length === 0 ? "passed" : `${failed.length} fallido(s)`}\n\n`;
md += `Run: ${runUrl}\n`;
if (GITHUB_SHA) md += `Commit: \`${GITHUB_SHA.slice(0, 7)}\`\n`;
md += `\n`;

if (failed.length > 0) {
  md += `| Test | Archivo | Estado | Error |\n|---|---|---|---|\n`;
  for (const f of failed) {
    md += `| ${f.title} | \`${f.file}:${f.line}\` | ${f.status} | ${(f.error || "").replace(/\|/g, "\\|").slice(0, 160)} |\n`;
  }
  md += `\nArtifacts (trace / video / screenshot): ${artifactsUrl}\n`;
  md += `\n> Abre el trace localmente: \`npx playwright show-trace <ruta-del-zip>\`\n`;
} else {
  md += `Sin fallos.\n`;
}

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) fs.appendFileSync(summaryPath, md + "\n");
fs.writeFileSync("playwright-report/pr-comment.md", md);
process.stdout.write(md);
