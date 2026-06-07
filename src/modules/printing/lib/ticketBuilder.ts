// Construye el ticket de venta (recibo cliente) y la comanda de cocina
// a partir de los datos de pos_orders + pos_order_items.
import { EscPosBuilder, charsForWidth, type Width } from "./escpos";

export interface TicketOrgInfo {
  business_name: string;
  legal_name?: string | null;
  nit?: string | null;
  address?: string | null;
  phone?: string | null;
  city?: string | null;
  footer?: string | null;
  logo_text?: string | null;
}

export interface TicketLine {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  modifiers?: { name: string; price?: number }[];
  notes?: string | null;
}

export interface TicketData {
  org: TicketOrgInfo;
  ticket_number?: number | string;
  cashier_name?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_document?: string | null;
  sale_mode?: string;
  created_at: string | Date;
  items: TicketLine[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  amount_paid: number;
  change_due: number;
  payments?: { method: string; amount: number }[];
  qr_payload?: string;
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtMoney = (n: number) => COP.format(n).replace("COP", "$").trim();
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short", hour12: false });

/** Recibo cliente (58 o 80mm). */
export function buildReceipt(t: TicketData, paperMm: 58 | 80 = 80): EscPosBuilder {
  const width: Width = charsForWidth(paperMm);
  const b = new EscPosBuilder({ width });
  b.init();

  // Cabecera
  b.align("center").bold(true).size(2);
  b.line(t.org.business_name);
  b.size(1).bold(false);
  if (t.org.legal_name) b.line(t.org.legal_name);
  if (t.org.nit) b.line(`NIT ${t.org.nit}`);
  if (t.org.address) b.line(t.org.address);
  if (t.org.phone) b.line(`Tel: ${t.org.phone}`);
  b.separator();

  // Meta
  b.align("left");
  if (t.ticket_number != null) b.line(`Ticket #${t.ticket_number}`);
  b.line(`Fecha: ${fmtDate(t.created_at)}`);
  if (t.cashier_name) b.line(`Cajero: ${t.cashier_name}`);
  if (t.sale_mode) b.line(`Modo: ${t.sale_mode}`);
  if (t.customer_name || t.customer_document) {
    b.line(`Cliente: ${t.customer_name ?? "Consumidor final"}`);
    if (t.customer_document) b.line(`Doc: ${t.customer_document}`);
    if (t.customer_phone) b.line(`Tel: ${t.customer_phone}`);
  }
  b.separator();

  // Items
  b.bold(true).twoCol("Producto", "Total").bold(false);
  for (const it of t.items) {
    const qty = it.quantity % 1 === 0 ? it.quantity.toString() : it.quantity.toFixed(2);
    b.twoCol(`${qty} x ${truncate(it.name, width - 12)}`, fmtMoney(it.total));
    if (it.unit_price !== it.total / Math.max(1, it.quantity)) {
      // descuento línea: no se muestra unitario distinto
    } else if (it.quantity > 1) {
      b.line(`   @ ${fmtMoney(it.unit_price)}`);
    }
    if (it.modifiers?.length) {
      for (const m of it.modifiers) {
        b.line(`   + ${m.name}${m.price ? `  ${fmtMoney(m.price)}` : ""}`);
      }
    }
    if (it.notes) b.line(`   * ${it.notes}`);
  }
  b.separator();

  // Totales
  b.twoCol("Subtotal", fmtMoney(t.subtotal));
  if (t.discount > 0) b.twoCol("Descuento", `-${fmtMoney(t.discount)}`);
  if (t.tax > 0) b.twoCol("IVA", fmtMoney(t.tax));
  if (t.tip > 0) b.twoCol("Propina", fmtMoney(t.tip));
  b.bold(true).size(2, 1).twoCol("TOTAL", fmtMoney(t.total)).size(1).bold(false);
  b.separator();

  if (t.payments?.length) {
    for (const p of t.payments) b.twoCol(p.method.toUpperCase(), fmtMoney(p.amount));
    b.twoCol("Recibido", fmtMoney(t.amount_paid));
    if (t.change_due > 0) b.twoCol("Cambio", fmtMoney(t.change_due));
    b.separator();
  }

  // QR
  if (t.qr_payload) {
    b.align("center").qr(t.qr_payload, paperMm === 58 ? 5 : 6);
    b.line();
  }

  // Footer
  b.align("center");
  b.line(t.org.footer ?? "Gracias por su compra");
  b.line("Powered by SistecPOS");
  b.cut(true);
  return b;
}

/** Comanda cocina (recortada, sin precios). */
export function buildKitchen(
  t: Pick<TicketData, "ticket_number" | "created_at" | "items" | "sale_mode" | "customer_name">,
  stationName: string,
  paperMm: 58 | 80 = 80,
): EscPosBuilder {
  const width: Width = charsForWidth(paperMm);
  const b = new EscPosBuilder({ width });
  b.init();

  b.align("center").bold(true).size(2, 2).line(stationName.toUpperCase()).size(1).bold(false);
  b.separator("=");
  b.align("left");
  if (t.ticket_number != null) b.bold(true).size(2, 1).line(`Ticket #${t.ticket_number}`).size(1).bold(false);
  b.line(fmtDate(t.created_at));
  if (t.sale_mode) b.line(`Modo: ${t.sale_mode}`);
  if (t.customer_name) b.line(`Cliente: ${t.customer_name}`);
  b.separator();
  for (const it of t.items) {
    const qty = it.quantity % 1 === 0 ? it.quantity.toString() : it.quantity.toFixed(2);
    b.bold(true).size(1, 2).line(`${qty} x ${it.name}`).size(1).bold(false);
    if (it.modifiers?.length) {
      for (const m of it.modifiers) b.line(`   + ${m.name}`);
    }
    if (it.notes) b.line(`   * ${it.notes}`);
    b.line();
  }
  b.separator("=");
  b.cut(true);
  return b;
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
