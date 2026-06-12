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
const BASELINE = 235; // hallazgos al cierre de Etapa 32
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

const cmd = new Deno.Command("rg", {
  args: ["-n", "--no-heading", TERMS.join("|"), ...SCOPES],
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
