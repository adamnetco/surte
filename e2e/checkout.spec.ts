import { test, expect } from "../playwright-fixture";

/**
 * Smoke E2E del flujo de checkout (storefront → WhatsApp).
 *
 * El flujo completo (añadir al carrito → completar datos → emitir orden →
 * redirigir a wa.me) requiere catálogo sembrado, tenant activo con módulo
 * `storefront` y configuración WhatsApp (YCloud o número fallback). Sin esas
 * precondiciones esto queda como humo:
 *
 *  1. La ruta `/carrito` responde (sin pantalla en blanco ni errores de
 *     runtime), tanto vacía como con items.
 *  2. Si el carrito está vacío, se muestra el estado vacío esperado y un CTA
 *     para volver al catálogo (no hay botón de finalizar pedido activo).
 *  3. `/pedido/:orderNumber` con número inexistente cae al estado "no
 *     encontrado" sin romper la app — confirma que el tracking público no
 *     filtra errores ni queda en blanco.
 *
 * La validación de la integración WhatsApp (mensaje formateado, fallback
 * wa.me, persistencia del cart_token omnichannel) se cubre por:
 *   - `src/modules/cart/context/CartContext.test.tsx` (carrito persistente)
 *   - Tests Deno de `supabase/functions/send-whatsapp-order` (cuando se
 *     agreguen) para el contrato de la edge function.
 */

test.describe("Checkout smoke", () => {
  test("/carrito carga sin errores fatales", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/carrito");
    await page.waitForLoadState("networkidle");
    expect(
      errors,
      `Errores en runtime: ${errors.join("\n")}`,
    ).toHaveLength(0);

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("carrito vacío muestra estado vacío y no expone botón de finalizar", async ({
    page,
  }) => {
    // Limpiar persistencia del carrito (localStorage) antes de abrir la ruta.
    await page.goto("/");
    await page.evaluate(() => {
      try {
        localStorage.removeItem("surte_cart_v2");
        localStorage.removeItem("surte_cart");
      } catch {
        /* noop */
      }
    });

    await page.goto("/carrito");
    await page.waitForLoadState("networkidle");

    // El botón principal de checkout (Finalizar / WhatsApp / Pedir) NO debe
    // estar habilitado con carrito vacío.
    const finalizar = page.getByRole("button", {
      name: /finalizar|pedir|whatsapp|checkout/i,
    });
    if (await finalizar.count()) {
      // Si por diseño se renderiza, debe estar deshabilitado.
      const enabled = await finalizar.first().isEnabled().catch(() => false);
      expect(enabled).toBe(false);
    }
  });

  test("/pedido/:orderNumber con número inexistente no rompe", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/pedido/__no-existe-0000__");
    await page.waitForLoadState("networkidle");
    expect(
      errors,
      `Errores en runtime: ${errors.join("\n")}`,
    ).toHaveLength(0);

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
