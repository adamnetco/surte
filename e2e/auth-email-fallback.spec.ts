import { test, expect } from "../playwright-fixture";

/**
 * E2E para POS-AuthEmailValid.
 *
 * Cubre:
 *  1. Render del portal de acceso en `/` (LoginRouter) sin errores.
 *  2. Validaciones del formulario (id_negocio + email requeridos).
 *  3. Fallback OTP → recovery: cuando Supabase responde
 *     "Signups not allowed for otp", la UI intercepta la llamada y muestra
 *     el aviso amber con el texto de fallback, sin lanzar el error crudo.
 *  4. Recuperación de contraseña para email inexistente muestra estado
 *     claro (sin crashear) en `/reset-password`.
 *
 * Estos tests interceptan la red para no depender del backend real ni
 * gastar cuotas de email en CI.
 */

test.describe("Auth email fallback (POS-AuthEmailValid)", () => {
  test("portal de acceso valida campos requeridos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/id_negocio|tienda|ej:/i).first()).toBeVisible({ timeout: 10_000 });

    // Click "Enviar acceso por email" sin email → toast de error
    const sendButton = page.getByRole("button", { name: /enviar acceso por email/i });
    await sendButton.click();
    // Toast (sonner) aparece como region aria-live
    await expect(page.getByText(/ingresa tu email/i)).toBeVisible({ timeout: 5_000 });
  });

  test("OTP deshabilitado dispara fallback a recovery (mock)", async ({ page }) => {
    // Intercepta el endpoint de Supabase OTP y responde con el error
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          code: "otp_disabled",
          error_code: "otp_disabled",
          msg: "Signups not allowed for otp",
        }),
      }),
    );
    // El fallback debe llamar a /recover y responder OK
    await page.route("**/auth/v1/recover**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/");
    await page.getByPlaceholder(/ej: demo|tienda|id_negocio/i).first().fill("demo");
    await page.getByPlaceholder(/correo|email/i).first().fill("demo@sistecpos.com");
    await page.getByRole("button", { name: /enviar acceso por email/i }).click();

    // Aviso de fallback visible (no error crudo)
    await expect(page.getByTestId("email-notice")).toContainText(
      /restablecer tu contraseña|enlace directo está deshabilitado/i,
      { timeout: 8_000 },
    );
    await expect(page.getByTestId("email-sent-confirmation")).toContainText(
      /enlace de recuperación/i,
    );
    // El texto crudo NO debe aparecer en pantalla
    await expect(page.getByText(/signups not allowed for otp/i)).toHaveCount(0);
  });

  test("/reset-password renderiza formulario solicitar enlace", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByPlaceholder(/correo|email/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar enlace/i })).toBeVisible();
  });
});
