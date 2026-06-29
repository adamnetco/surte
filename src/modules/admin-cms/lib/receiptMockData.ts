import type { ReceiptChannel } from "./receiptLayoutSchema";

export interface MockOrder {
  order_number: string;
  date: string;
  cashier: string;
  register: string;
  channel: ReceiptChannel;
  customer: { name: string; document?: string; phone?: string };
  store: { name: string; nit: string; address: string; phone: string; email: string };
  items: Array<{
    qty: number;
    name: string;
    unit_price: number;
    total: number;
    modifiers?: string[];
    notes?: string;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  qr_url: string;
  // Slice 4 — campos contextuales para cocina y anulación.
  station?: string;
  table?: string;
  time?: string;
  void_reason?: string;
  fiscal_hash?: string;
  original_order?: string;
}

export function buildMockOrder(channel: ReceiptChannel): MockOrder {
  const base: MockOrder = {
    order_number: "POS-000124",
    date: new Date().toLocaleString("es-CO"),
    cashier: "María G.",
    register: "Caja 1",
    channel,
    customer: { name: "Carlos Mendoza", document: "CC 1.098.765.432", phone: "300 555 1212" },
    store: {
      name: "SistecPOS Demo Store",
      nit: "NIT 900.123.456-7",
      address: "Cra 27 #36-15, Bucaramanga",
      phone: "+57 607 555 0123",
      email: "ventas@sistecpos.com",
    },
    items: [
      { qty: 2, name: "Bandeja paisa", unit_price: 28000, total: 56000, modifiers: ["+ Arepa extra"], notes: "Sin cilantro" },
      { qty: 1, name: "Limonada de coco", unit_price: 8500, total: 8500 },
      { qty: 3, name: "Empanada de carne", unit_price: 3500, total: 10500 },
    ],
    subtotal: 75000,
    discount: 0,
    tax: 6000,
    tip: 7500,
    total: 88500,
    payments: [{ method: "Efectivo", amount: 100000 }],
    qr_url: "https://sistecpos.com/o/POS-000124",
  };
  if (channel === "kitchen") {
    base.items = base.items.map((i) => ({ ...i, unit_price: 0, total: 0 }));
    base.station = "COCINA CALIENTE";
    base.table = "Mesa 15A";
    base.time = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }
  if (channel === "void") {
    base.items = [{ qty: 1, name: "Bandeja paisa", unit_price: 28000, total: 28000 }];
    base.total = 28000;
    base.void_reason = "Error en pedido del cliente";
    base.fiscal_hash = "a1b2c3d4e5f6...";
    base.original_order = "POS-000123";
  }
  return base;
}
