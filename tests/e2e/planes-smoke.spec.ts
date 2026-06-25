import { test, expect } from "@playwright/test";

/**
 * Phase 3 — Smoke test
 * Verifica que /planes muestra los 4 planes públicos (Free, Pro, Business, Enterprise)
 * cuando saas_plans.is_public = true. Detecta regresiones de GRANT/RLS que vacíen el grid.
 */
test.describe("/planes — smoke", () => {
  test("muestra Free, Pro, Business y Enterprise públicos", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/planes", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    for (const name of ["Free", "Pro", "Business", "Enterprise"]) {
      await expect(
        page.getByRole("heading", { level: 3, name, exact: true }),
        `Plan "${name}" debería aparecer en /planes`
      ).toBeVisible();
    }

    // No debe mostrarse el estado vacío
    await expect(page.getByText(/no hay planes publicados/i)).toHaveCount(0);
    await expect(page.getByText(/no pudimos cargar los planes/i)).toHaveCount(0);

    const fatal = errors.filter((e) => !/Failed to load resource|ResizeObserver/.test(e));
    expect(fatal, `Errores de consola: ${fatal.join("\n")}`).toEqual([]);
  });
});
