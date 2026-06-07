import { test, expect } from "../playwright-fixture";

/**
 * Smoke E2E del flujo POS.
 *
 * El flujo completo (apertura → añadir → cobro → SaleCompleteDialog → nueva
 * venta → cierre Z) requiere un cajero sembrado, sede + caja activas y módulo
 * pos_counter habilitado. Sin esas precondiciones, el e2e queda como humo:
 *
 *  1. /pos responde (login o workspace), sin pantalla en blanco.
 *  2. No hay errores fatales de runtime al cargar la ruta.
 *  3. Si la sesión está abierta, el botón COBRAR es visible y accesible
 *     (sanity check del workspace) y el overlay no queda atascado.
 *
 * Para validar el ciclo completo (incluyendo que SaleCompleteDialog no
 * bloquee el cierre Z) se utiliza el test unitario
 * `src/components/pos/SaleCompleteDialog.test.tsx`, que cubre la regresión
 * del overlay residual sin depender del backend.
 */

test.describe("POS smoke", () => {
  test("la ruta /pos carga sin errores fatales", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/pos");
    await page.waitForLoadState("networkidle");
    expect(
      errors,
      `Errores en runtime: ${errors.join("\n")}`,
    ).toHaveLength(0);

    // O bien login, o el panel de apertura, o el workspace.
    const url = page.url();
    expect(url).toMatch(/(login|pos)/);
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("si el workspace está activo, COBRAR es accesible y no hay overlay atascado", async ({
    page,
  }) => {
    await page.goto("/pos/vender");
    await page.waitForLoadState("networkidle");

    const cobrar = page.getByRole("button", { name: /cobrar/i });
    if (await cobrar.count()) {
      await expect(cobrar.first()).toBeVisible();
      // Ningún overlay de Radix (data-state="open") debe quedar montado
      // al cargar la pantalla — eso confirma que SaleCompleteDialog y demás
      // diálogos arrancan cerrados.
      const stuckOverlay = page.locator(
        '[data-radix-portal] [data-state="open"][role="dialog"]',
      );
      expect(await stuckOverlay.count()).toBe(0);
    }
  });
});
