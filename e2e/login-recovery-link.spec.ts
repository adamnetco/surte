import { test, expect } from "@playwright/test";

// AC7 — POS-MejoraLoginModerno
// El link "Recuperar acceso" debe navegar a /reset-password
// preservando el slug de tienda escrito por el usuario.
test.describe("LoginRouter — Recuperar acceso", () => {
  test("preserva el slug de tienda en /reset-password", async ({ page }) => {
    await page.goto("/admin/login");

    await page.fill("#login-tienda", "demo");

    const link = page.getByTestId("recover-access-link");
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL(/\/reset-password/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("tienda")).toBe("demo");
  });

  test("sin slug, navega a /reset-password sin querystring de tienda", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByTestId("recover-access-link").click();
    await page.waitForURL(/\/reset-password/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("tienda")).toBeNull();
  });
});
