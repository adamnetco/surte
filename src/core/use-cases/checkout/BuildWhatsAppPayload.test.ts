import { describe, it, expect } from "vitest";
import { buildWhatsAppPayload } from "./BuildWhatsAppPayload";
import { percent } from "@/core/domain/value-objects/Discount";

const cart = {
  currency: "COP" as const,
  lines: [
    { productId: "1", name: "Arroz 1kg", quantity: 2, unitPrice: 5000 },
    { productId: "2", name: "Aceite 500ml", quantity: 1, unitPrice: 12_000 },
  ],
};

const customer = { name: "Ana Perez", phone: "3001234567" };

describe("buildWhatsAppPayload", () => {
  it("produce texto plano sin emojis con totales COP", () => {
    const p = buildWhatsAppPayload({
      tenantName: "SurteYa",
      cart,
      customer,
      deliveryCost: 3000,
    });
    expect(p.totals.subtotal).toBe(22_000);
    expect(p.totals.delivery).toBe(3000);
    expect(p.totals.total).toBe(25_000);
    expect(p.text).toContain("Nuevo pedido - SurteYa");
    expect(p.text).toContain("- 2 x Arroz 1kg");
    expect(p.text).toContain("Envio:");
    expect(p.text).toContain("Total:");
    // No emojis (safe-emoji filter): comprobamos que no aparezcan pictogramas típicos.
    expect(/[\u{1F300}-\u{1FAFF}]/u.test(p.text)).toBe(false);
  });

  it("aplica descuento y adjunta CART: token cuando se pasa", () => {
    const p = buildWhatsAppPayload({
      tenantName: "Demo",
      cart,
      customer,
      discount: percent(10),
      cartToken: "abc-123",
    });
    // 22000 * 0.9 = 19800
    expect(p.totals.subtotal).toBe(19_800);
    expect(p.text).toContain("Descuento: -");
    expect(p.text).toContain("CART:abc-123");
  });

  it("omite delivery y descuento cuando son cero", () => {
    const p = buildWhatsAppPayload({ tenantName: "T", cart, customer });
    expect(p.text).not.toContain("Envio:");
    expect(p.text).not.toContain("Descuento:");
  });
});
