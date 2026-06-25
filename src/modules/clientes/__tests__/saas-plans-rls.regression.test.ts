/**
 * Phase 5 — Regresión idempotente de RLS/GRANT sobre `saas_plans`.
 *
 * Verifica el contrato Data-API directamente con la anon key (sin UI):
 *   1. Existen al menos los 4 planes públicos canónicos (free/pro/business/enterprise).
 *   2. Cada uno tiene `is_public = true` y `sort_order` consistente.
 *   3. anon NO puede insertar (RLS bloquea).
 *
 * Si un futuro cambio rompe los GRANTs (PostgREST 401/42501) o las policies
 * (devuelve 0 filas), este test falla antes que /planes se quede en blanco.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const hasEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const d = hasEnv ? describe : describe.skip;

d("saas_plans — RLS/GRANT regression (anon)", () => {
  const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it("anon puede leer los 4 planes públicos canónicos", async () => {
    const { data, error } = await anon
      .from("saas_plans")
      .select("key, name, is_public, sort_order")
      .eq("is_public", true)
      .order("sort_order");

    expect(error, `Data API error: ${error?.message ?? ""}`).toBeNull();
    expect(data, "saas_plans no devolvió filas para anon").toBeTruthy();

    const keys = (data ?? []).map((p) => p.key);
    for (const required of ["free", "pro", "business", "enterprise"]) {
      expect(keys, `Falta plan público canónico "${required}"`).toContain(required);
    }
    for (const row of data ?? []) {
      expect(row.is_public).toBe(true);
      expect(typeof row.sort_order).toBe("number");
    }
  });

  it("anon NO puede insertar en saas_plans (RLS bloquea)", async () => {
    const { error } = await anon.from("saas_plans").insert({
      key: `__test_${Date.now()}`,
      name: "RLS regression probe",
      price_monthly: 0,
      price_yearly: 0,
      modules: [],
      limits: {},
    } as never);
    // Esperamos error (RLS / GRANT). Cualquier resultado exitoso es regresión.
    expect(error, "anon logró insertar en saas_plans — RLS roto").toBeTruthy();
  });
});
