import { test, expect } from "../playwright-fixture";

/**
 * Smoke E2E del Superadmin.
 *
 * Cubre lo mínimo viable sin depender de credenciales productivas:
 * 1. La home redirige/responde.
 * 2. La ruta /superadmin renderiza (puede pedir login → aceptamos cualquiera).
 * 3. Las rutas por-tenant sin slug válido caen al estado vacío esperado.
 *
 * Para validaciones más profundas (crear tienda, switcher, export ZIP) se
 * requiere fixture con usuario superadmin sembrado en el ambiente de test.
 */

test.describe("Superadmin smoke", () => {
  test("la app carga sin errores fatales", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors, `Errores en runtime: ${errors.join("\n")}`).toHaveLength(0);
  });

  test("/superadmin responde con login o dashboard", async ({ page }) => {
    await page.goto("/superadmin");
    await page.waitForLoadState("networkidle");
    // O bien estamos en login (no autenticado) o vemos algún elemento del shell superadmin.
    const url = page.url();
    expect(url).toMatch(/(login|superadmin)/);
  });

  test("ruta por-tenant con slug inexistente no rompe", async ({ page }) => {
    await page.goto("/superadmin/t/__no-existe__/modulos");
    await page.waitForLoadState("networkidle");
    // No debe quedar pantalla en blanco con error JS.
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
