import { test, expect } from "@playwright/test";

// AC6 — POS-MejoraLoginModerno
// /auth-status y /admin/auth-status están protegidos por MasterOnlyGuard.
// Un usuario no autenticado debe ser redirigido fuera (a "/").
test.describe("AuthStatus MasterOnlyGuard", () => {
  test("usuario sin sesión es redirigido fuera de /auth-status", async ({ page }) => {
    await page.goto("/auth-status");
    // El guard muestra "Verificando acceso…" mientras carga y luego redirige.
    await page.waitForURL((url) => !url.pathname.includes("/auth-status"), {
      timeout: 10_000,
    });
    expect(page.url()).not.toContain("/auth-status");
  });

  test("usuario sin sesión también es redirigido fuera de /admin/auth-status", async ({ page }) => {
    await page.goto("/admin/auth-status");
    await page.waitForURL((url) => !url.pathname.includes("/auth-status"), {
      timeout: 10_000,
    });
    expect(page.url()).not.toContain("/auth-status");
  });
});
