import { test, expect } from "@playwright/test";

// Smoke E2E: AC8 — Cloudflare API mockeada.
// El happy path con CF real corre en nightly.
test.describe("Sitios → Eliminar dominio (smoke)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock de la edge function delete-tenant-domain.
    await page.route("**/functions/v1/delete-tenant-domain", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          deleted: { id: body.domain_id, hostname: body.confirm_hostname },
          cloudflare_purged: true,
        }),
      });
    });
  });

  test("abre dialog, requiere tipear hostname exacto, deshabilita botón si no coincide", async ({ page }) => {
    // Stub mínimo: solo verificamos el contrato del dialog sin requerir login real.
    // El test asume que existe al menos un dominio listado en /sitios para el superadmin seedeado.
    await page.goto("/sitios");

    // Si la página redirige a login en CI sin sesión, salimos como skip controlado.
    if (page.url().includes("/login")) test.skip(true, "Sin sesión superadmin en CI smoke");

    await page.getByRole("tab", { name: /dominios/i }).click();

    const firstDelete = page.locator("[data-testid^='delete-domain-']").first();
    if ((await firstDelete.count()) === 0) test.skip(true, "Sin dominios para probar");

    const hostname = (await firstDelete.getAttribute("data-testid"))?.replace("delete-domain-", "") ?? "";
    await firstDelete.click();

    const input = page.getByTestId("delete-domain-confirm-input");
    const confirmBtn = page.getByTestId("delete-domain-confirm-btn");

    await expect(confirmBtn).toBeDisabled();
    await input.fill("foo.invalid");
    await expect(confirmBtn).toBeDisabled();
    await input.fill(hostname);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Toast de éxito.
    await expect(page.getByText(/dominio eliminado/i)).toBeVisible({ timeout: 5000 });
  });

  test("banner de scope visible en /sitios", async ({ page }) => {
    await page.goto("/sitios");
    if (page.url().includes("/login")) test.skip(true, "Sin sesión superadmin en CI smoke");
    await expect(page.getByTestId("sitios-scope-banner")).toBeVisible();
  });
});
