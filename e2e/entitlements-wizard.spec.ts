/**
 * E2E — Entitlements Wizard Unification (AC8)
 *
 * Verifica que al intentar activar un módulo fuera del plan desde el
 * onboarding del cliente, se redirige a /clientes/planes con los query
 * params correctos (highlight + reason + return_to) y se muestra el
 * banner contextual de upgrade.
 *
 * Pre-requisito: existe un tenant Free con un módulo bloqueado visible
 * en el step 4 del Onboarding (seed determinístico).
 */
import { test, expect } from "./../playwright-fixture";

test.describe("Entitlements wizard — gating al cliente", () => {
  test("módulo fuera del plan redirige a /clientes/planes con highlight+reason", async ({ page }) => {
    await page.goto("/clientes/onboarding");

    // Esperar a que el step de módulos renderice el componente compartido.
    const wizardStep = page.getByRole("button", { name: /Requiere upgrade/i }).first();
    await expect(wizardStep).toBeVisible({ timeout: 15_000 });

    await wizardStep.click();

    // Debe redirigir a Planes con los query params definidos en la spec.
    await page.waitForURL(/\/clientes\/planes\?.*highlight=.*reason=.*return_to=/, {
      timeout: 5_000,
    });

    const url = new URL(page.url());
    expect(url.searchParams.get("highlight")).toBeTruthy();
    expect(url.searchParams.get("reason")).toBeTruthy();
    expect(url.searchParams.get("return_to")).toContain("/clientes/onboarding");

    // Banner contextual visible
    await expect(page.getByText(/Necesitas el plan/i)).toBeVisible();
  });

  test("componente compartido se renderiza en el wizard del superadmin tras crear tenant", async ({ page }) => {
    // Smoke: tras completar el wizard del superadmin, la pantalla de resultado
    // muestra el bloque "Módulos resueltos del plan" usando EntitlementsWizardStep.
    // Este test asume que existe una ruta de fixtures que monta el wizard en
    // estado "Result". Si no, se marca como skip — la verificación principal
    // es el gating al cliente (test anterior).
    test.skip(
      !process.env.E2E_HAS_SUPERADMIN_FIXTURE,
      "Fixture de superadmin no disponible en este entorno",
    );

    await page.goto("/superadmin/clientes?wizard=result-fixture");
    await expect(page.getByText(/Módulos resueltos del plan/i)).toBeVisible();
  });
});
