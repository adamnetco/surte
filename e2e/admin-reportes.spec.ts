import { test, expect } from "../playwright-fixture";

/**
 * Smoke E2E /admin/reportes (Ola 7).
 * No depende de credenciales: valida que la ruta no crashea.
 */
test.describe("Admin Reportes — smoke", () => {
  test("la ruta /admin/reportes responde sin errores fatales", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin/reportes");
    await page.waitForLoadState("networkidle");
    expect(errors, `Errores runtime: ${errors.join("\n")}`).toHaveLength(0);
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
