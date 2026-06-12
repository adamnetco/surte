#!/usr/bin/env bun
/**
 * Etapa 32-40 — Guarda anti-regresión de hardcoding tenant-specific.
 *
 * Cuenta ocurrencias de términos atados a SurteYa / Bucaramanga / Santander
 * y rubros específicos en carpetas blindadas del core. Si el total supera el
 * baseline declarado, falla con exit code 1.
 *
 * Uso:
 *   bun run scripts/audit-hardcoding.ts
 *   npm run audit:hardcoding
 *
 * El baseline se reduce a medida que avanzan las etapas. Meta final = 0.
 */
import { spawnSync } from "node:child_process";

const BASELINE = 6; // Etapa 40 — fallback keys legacy + READMEs + cloudTasks aceptados como deuda controlada.
const TERMS = [
  "surteya",
  "SurteYa",
  "Bucaramanga",
  "Santander",
  "Cárnicos",
  "Pulpas",
  "Panificados",
];
const SCOPES = ["src/", "supabase/"];
// Excluidos del audit (legítimos o gestionados por scaffolds):
// - supabase/migrations + supabase/seeds: seeds históricos / tenant-específicos.
// - supabase/functions/<scaffolds>: scaffold de email-domain Lovable-managed.
// - SurteyaRedirect.tsx, legacyDomains.ts: redirección de dominio legacy.
// - Fallback keys legacy (storage migration): cartToken/CartContext/ThemeContext/OrganizationContext.
// - READMEs de módulos (documentación histórica).
// - *.test.ts(x): fixtures con dominios reales.
const IGNORE_GLOBS = [
  "supabase/migrations",
  "supabase/seeds",
  "supabase/functions/auth-email-hook",
  "supabase/functions/send-transactional-email",
  "supabase/functions/resend-mail-service",
  "supabase/functions/send-web-push",
  "supabase/functions/_shared/transactional-email-templates",
  "src/components/SurteyaRedirect.tsx",
  "src/modules/tenant/lib/legacyDomains.ts",
  "src/modules/cart/lib/cartToken.ts",
  "src/modules/cart/context/CartContext.tsx",
  "src/modules/platform/context/ThemeContext.tsx",
  "src/modules/platform/context/OrganizationContext.tsx",
  "**/README.md",
  "**/*.test.ts",
  "**/*.test.tsx",
];

const args = [
  "-n",
  "--no-heading",
  ...IGNORE_GLOBS.flatMap((g) => ["-g", `!${g}`, "-g", `!${g}/**`]),
  TERMS.join("|"),
  ...SCOPES,
];

const result = spawnSync("rg", args, { encoding: "utf8" });
// rg exit code 1 = no matches (no es error). >1 = error real.
if (result.status !== null && result.status > 1) {
  console.error("rg failed:", result.stderr);
  process.exit(2);
}

const lines = (result.stdout || "")
  .split("\n")
  .filter((l) => l.trim().length > 0);

console.log(`hardcoding hits: ${lines.length} (baseline ${BASELINE})`);
if (lines.length > BASELINE) {
  console.error("❌ Regresión: supera el baseline. Revisa diff reciente.");
  console.error(lines.slice(0, 30).join("\n"));
  if (lines.length > 30) console.error(`… (+${lines.length - 30} más)`);
  process.exit(1);
}
if (lines.length < BASELINE) {
  console.warn(
    `ℹ️  Baseline desactualizado: bajaron a ${lines.length}. Actualiza BASELINE en este script.`,
  );
}
