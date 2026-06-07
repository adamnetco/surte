import { describe, it, expect } from "vitest";
import { buildReceipt, buildKitchen, type TicketData } from "./ticketBuilder";

const base: TicketData = {
  org: { business_name: "Surteya Distribuciones", nit: "900.123.456-7", address: "Cra 27 # 34-12, Bucaramanga", phone: "318 555 1234", footer: "Gracias por preferirnos" },
  ticket_number: 1042,
  cashier_name: "Eduardo",
  customer_name: "Juan Pérez",
  sale_mode: "mesa",
  created_at: new Date("2026-06-07T18:30:00-05:00"),
  items: [
    { name: "Bandeja paisa", quantity: 2, unit_price: 32000, total: 64000, modifiers: [{ name: "Sin aguacate" }], notes: "Bien cocido" },
    { name: "Limonada de coco", quantity: 1, unit_price: 9000, total: 9000 },
  ],
  subtotal: 73000, discount: 0, tax: 0, tip: 7300, total: 80300,
  amount_paid: 100000, change_due: 19700,
  payments: [{ method: "efectivo", amount: 100000 }],
  qr_payload: "https://sistecpos.com/v/1042",
};

describe("ticketBuilder", () => {
  it("genera bytes ESC/POS no vacíos para 80mm", () => {
    const buf = buildReceipt(base, 80).build();
    expect(buf.length).toBeGreaterThan(200);
    // ESC @ al inicio
    expect(buf[0]).toBe(0x1b);
    expect(buf[1]).toBe(0x40);
  });

  it("genera ticket compacto en 58mm", () => {
    const buf58 = buildReceipt(base, 58).build();
    const buf80 = buildReceipt(base, 80).build();
    expect(buf58.length).toBeLessThan(buf80.length + 100);
  });

  it("comanda cocina sin precios", () => {
    const b = buildKitchen(base, "Cocina caliente", 80);
    const s = new TextDecoder("latin1").decode(b.build());
    expect(s).toContain("COCINA CALIENTE");
    expect(s).toContain("Bandeja paisa");
    expect(s).not.toContain("$");
  });

  it("base64 estable", () => {
    const b64 = buildReceipt(base, 80).toBase64();
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
