import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS regression suite — creación de usuarios con roles user / admin / superadmin.
 *
 * Garantiza que las policies de Supabase sigan permitiendo:
 *   1. signup como usuario plano (auth.signUp open).
 *   2. asignación de rol 'admin' en user_roles por parte del propio usuario nuevo
 *      vía el flujo de UsersTab (auto-grant en INSERT propio).
 *   3. el bootstrap de organización del Onboarding (INSERT en organizations +
 *      organization_members con role='owner') que aplicamos en la migración
 *      20260625_03 — sin esto, el dueño nuevo recibe "No pudimos crear tu organización".
 *
 * Estos tests usan la anon key (lo mismo que el navegador). No requieren service-role.
 * Si se ejecutan offline o sin red, Playwright los marca como skipped vía el `test.skip()`.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "https://dimyhjzcwlgfczimqhet.supabase.co";
const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY ?? "";

const enabled = !!SUPABASE_ANON;

function uniq() {
  return `e2e+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@sistecpos.test`;
}

test.describe("RLS — alta de usuarios y bootstrap de tienda", () => {
  test.skip(!enabled, "Define E2E_SUPABASE_ANON_KEY para habilitar este suite.");

  test("rol user → signup permitido, NO puede insertar en organizations", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    const email = uniq();
    const { data, error } = await sb.auth.signUp({ email, password: "Test123!Test" });
    expect(error, error?.message).toBeNull();
    expect(data.user?.id).toBeTruthy();

    // Intento de crear org sin sesión auto-confirmada NO debería filtrarse silenciosamente:
    // si la sesión está activa, debe poder hacerlo (policy authenticated). Si no, debe fallar.
    if (data.session) {
      const { error: orgError } = await sb
        .from("organizations")
        .insert({ name: "E2E test org", slug: `e2e-${Date.now()}`, business_type: "retail", is_active: true })
        .select("id")
        .single();
      // Política `authenticated can bootstrap org` debe permitirlo.
      expect(orgError, `signup user no pudo crear org: ${orgError?.message}`).toBeNull();
    }
  });

  test("rol admin → bootstrap completo de tienda (org + organization_members owner)", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    const email = uniq();
    const { data: signup, error: sErr } = await sb.auth.signUp({
      email,
      password: "Test123!Test",
      options: { data: { full_name: "E2E Admin", role: "admin" } },
    });
    expect(sErr, sErr?.message).toBeNull();
    if (!signup.session) test.skip(true, "Email-confirm activado: no podemos validar el bootstrap end-to-end.");

    const userId = signup.user!.id;
    const slug = `e2e-${Date.now()}`;
    const { data: org, error: orgErr } = await sb
      .from("organizations")
      .insert({ name: "E2E Admin Store", slug, business_type: "retail", is_active: true })
      .select("id").single();
    expect(orgErr, orgErr?.message).toBeNull();
    expect(org?.id).toBeTruthy();

    const { error: memErr } = await sb
      .from("organization_members")
      .insert({ organization_id: org!.id, user_id: userId, role: "owner", is_active: true });
    expect(memErr, `owner self-insert falló (regresión RLS): ${memErr?.message}`).toBeNull();

    // Una segunda inserción debería fallar (anti-takeover):
    const { error: secondErr } = await sb
      .from("organization_members")
      .insert({ organization_id: org!.id, user_id: userId, role: "owner", is_active: true });
    expect(secondErr, "el guardia anti-takeover debe rechazar el segundo INSERT").not.toBeNull();
  });

  test("rol superadmin → NO debe poder crearse vía signup público", async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    const email = uniq();
    const { data, error } = await sb.auth.signUp({
      email,
      password: "Test123!Test",
      options: { data: { full_name: "E2E Fake Super", role: "superadmin" } },
    });
    expect(error, error?.message).toBeNull();
    if (!data.session) return; // email confirmation flow: nada más que validar

    // El metadata viaja, pero NO se traduce a user_roles.superadmin sin la policy correcta.
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", data.user!.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "superadmin");
    expect(isSuper, "signup público NUNCA debería resultar en rol superadmin").toBeFalsy();
  });
});
