#!/usr/bin/env -S deno run --allow-read --allow-run
/**
 * Etapa 32 — Guarda anti-regresión de hardcoding tenant-specific.
 *
 * Cuenta ocurrencias de términos atados a SurteYa / Bucaramanga / Santander
 * y rubros específicos en carpetas blindadas del core. Si el total supera el
 * baseline declarado, falla con exit code 1.
 *
 * El baseline se reduce a medida que avanzan las etapas 33-40. Meta final = 0.
 */
const BASELINE = 30; // Etapa 36.b — JsonLd/emailTemplates/comments neutralizados; scaffold + migraciones excluidos
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
// - supabase/migrations: seeds históricos (regla POS-primer: no se editan)
// - supabase/functions/auth-email-hook & send-transactional-email & resend-mail-service & send-web-push: scaffold de email-domain
// - SurteyaRedirect.tsx, legacyDomains.ts: redirección de dominio legacy
// - *.test.ts: fixtures con dominios reales
const IGNORE_GLOBS = [
  "supabase/migrations",
  "supabase/functions/auth-email-hook",
  "supabase/functions/send-transactional-email",
  "supabase/functions/resend-mail-service",
  "supabase/functions/send-web-push",
  "supabase/functions/_shared/transactional-email-templates",
  "src/components/SurteyaRedirect.tsx",
  "src/modules/tenant/lib/legacyDomains.ts",
  ".test.ts",
  ".test.tsx",
];

const cmd = new Deno.Command("rg", {
  args: [
    "-n",
    "--no-heading",
    ...IGNORE_GLOBS.flatMap((g) => ["-g", `!${g}`, "-g", `!${g}/**`]),
    TERMS.join("|"),
    ...SCOPES,
  ],
  stdout: "piped",
  stderr: "null",
});
const { stdout } = await cmd.output();
const lines = new TextDecoder()
  .decode(stdout)
  .split("\n")
  .filter((l) => l.trim().length > 0);

console.log(`hardcoding hits: ${lines.length} (baseline ${BASELINE})`);
if (lines.length > BASELINE) {
  console.error("❌ Regresión: supera el baseline. Revisa diff reciente.");
  Deno.exit(1);
}
if (lines.length < BASELINE) {
  console.warn(
    `ℹ️  Baseline desactualizado: bajaron a ${lines.length}. Actualiza BASELINE en este script.`,
  );
}
