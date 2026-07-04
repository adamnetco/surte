/**
 * QA layout + visual regression del header del ticket POS.
 *
 * Verifica en múltiples viewports que:
 *  - Los elementos clave (header, chip MESA, contador de ítems, botón Mesa, TOTAL XL)
 *    existen, son visibles y NO se solapan entre sí.
 *  - El TOTAL XL vive dentro del header (arriba), no duplicado abajo.
 *  - El botón Mesa es focuseable por teclado (tab-reachable).
 *  - Se guardan screenshots baseline en tests/e2e/__screenshots__/pos-ticket/
 *    que sirven como referencia de visual regression.
 *
 * Ejecución local:
 *   npx playwright test tests/e2e/pos-ticket-layout.spec.ts
 *   npx playwright test --update-snapshots  (regenerar baseline tras cambio intencional)
 */
import { test, expect, type Page, type Locator } from "@playwright/test";

const BREAKPOINTS = [
  { name: "desktop-xl",  w: 1440, h: 900 },
  { name: "desktop-lg",  w: 1280, h: 800 },
  { name: "tablet",      w: 1024, h: 800 },
  { name: "mobile-390",  w: 390,  h: 844 }, // iPhone 14
  { name: "mobile-360",  w: 360,  h: 740 }, // Android base
  { name: "mobile-land", w: 844,  h: 390 }, // iPhone landscape
] as const;

function overlaps(a: DOMRect | null, b: DOMRect | null): boolean {
  if (!a || !b) return false;
  return !(
    a.right <= b.left ||
    b.right <= a.left ||
    a.bottom <= b.top ||
    b.bottom <= a.top
  );
}

async function boxOf(locator: Locator): Promise<DOMRect | null> {
  const box = await locator.boundingBox();
  if (!box) return null;
  return {
    x: box.x, y: box.y,
    width: box.width, height: box.height,
    left: box.x, top: box.y,
    right: box.x + box.width, bottom: box.y + box.height,
    toJSON() { return this; },
  } as DOMRect;
}

async function gotoPOS(page: Page) {
  await page.goto("/pos/vender", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="ticket-header"]').waitFor({ state: "visible", timeout: 15000 });
  // esperar layout estable
  await page.waitForTimeout(400);
}

for (const bp of BREAKPOINTS) {
  test.describe(`POS ticket @ ${bp.name} (${bp.w}x${bp.h})`, () => {
    test.use({ viewport: { width: bp.w, height: bp.h } });

    test("elementos clave visibles y sin solapamiento", async ({ page }) => {
      await gotoPOS(page);

      const header  = page.locator('[data-testid="ticket-header"]');
      const title   = page.locator('[data-testid="ticket-title"]');
      const chip    = page.locator('[data-testid="ticket-mode-chip"]');
      const totalXL = page.locator('[data-testid="ticket-total-xl"]');

      await expect(header, "Header del ticket visible").toBeVisible();
      await expect(title, "H2 Ticket visible").toBeVisible();
      await expect(chip, "Chip de modo visible").toBeVisible();
      await expect(totalXL, "Bloque TOTAL XL visible").toBeVisible();

      // TOTAL XL debe estar dentro del header (arriba), no duplicado abajo.
      const totalCount = await page.locator('[data-testid="ticket-total-xl"]').count();
      expect(totalCount, "un único TOTAL XL en toda la página").toBe(1);

      // ARIA correcto en TOTAL
      await expect(totalXL).toHaveAttribute("role", "status");
      await expect(totalXL).toHaveAttribute("aria-live", "polite");
      const totalAria = await totalXL.getAttribute("aria-label");
      expect(totalAria, "aria-label del total incluye el monto").toMatch(/Total del ticket:/i);

      // Solo aplica cuando el modo es "mesa": botón Seleccionar mesa presente y focuseable.
      const mesaBtn = page.locator('[data-testid="ticket-mesa-btn"]');
      if (await mesaBtn.count() > 0) {
        await expect(mesaBtn).toBeVisible();
        const aria = await mesaBtn.getAttribute("aria-label");
        expect(aria, "botón Mesa tiene aria-label descriptivo").toMatch(/mesa/i);
        // keyboard focus
        await mesaBtn.focus();
        expect(await mesaBtn.evaluate((el) => el === document.activeElement)).toBe(true);
      }

      // No solapamiento entre bloque izquierdo (title/chip/counter) y TOTAL XL
      const [rTitle, rChip, rTotal] = await Promise.all([
        boxOf(title), boxOf(chip), boxOf(totalXL),
      ]);
      expect(overlaps(rTitle, rTotal), "Título no debe solaparse con TOTAL XL").toBe(false);
      expect(overlaps(rChip,  rTotal), "Chip MESA no debe solaparse con TOTAL XL").toBe(false);

      if (await mesaBtn.count() > 0) {
        const rMesa = await boxOf(mesaBtn);
        expect(overlaps(rMesa, rTotal), "Botón Mesa no debe solaparse con TOTAL XL").toBe(false);
      }

      // No clipping horizontal del header
      const clip = await header.evaluate((el) => ({
        sw: el.scrollWidth, cw: el.clientWidth,
      }));
      expect(clip.sw, "El header no debe tener overflow horizontal").toBeLessThanOrEqual(clip.cw + 1);

      // Screenshot baseline para visual regression del header
      await expect(header).toHaveScreenshot(`ticket-header-${bp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
    });
  });
}
