// Motor declarativo de impresión: toma un `Layout` (pos_receipt_templates.layout)
// y un `TicketData`, y produce un EscPosBuilder listo para enviar.
//
// Ola 27-bis · Slice B — Unifica el preview 80mm del configurador visual con
// la impresión real, eliminando la dependencia de plantillas hardcoded en
// `ticketBuilder.ts`.
import { EscPosBuilder, charsForWidth, type Width } from "./escpos";
import type { Layout, Section } from "@/modules/admin-cms/lib/receiptLayoutSchema";
import type { TicketData } from "./ticketBuilder";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const fmtMoney = (n: number) => COP.format(n).replace("COP", "$").trim();
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  });

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export interface RenderOptions {
  paperMm?: 58 | 80;
  /** Forzar ancho condensado en 80mm (42 chars). */
  condensed?: boolean;
}

/**
 * Renderiza una plantilla declarativa a ESC/POS.
 * Las secciones invisibles se omiten. Las desconocidas se ignoran sin error.
 */
export function renderLayout(
  layout: Layout,
  ticket: TicketData,
  opts: RenderOptions = {},
): EscPosBuilder {
  const paperMm = opts.paperMm ?? 80;
  const width: Width = opts.condensed && paperMm === 80 ? 42 : charsForWidth(paperMm);
  const b = new EscPosBuilder({ width });
  b.init();

  for (const section of layout.sections) {
    if (section.visible === false) continue;
    renderSection(b, section, ticket, width, paperMm);
  }

  b.cut(true);
  return b;
}

function renderSection(
  b: EscPosBuilder,
  s: Section,
  t: TicketData,
  width: Width,
  paperMm: 58 | 80,
) {
  switch (s.type) {
    case "logo": {
      b.align(s.align).bold(true).size(2, 2).line(t.org.business_name).size(1).bold(false);
      b.align("left");
      return;
    }
    case "store_info": {
      b.align("center");
      for (const field of s.fields) {
        switch (field) {
          case "name":
            if (t.org.legal_name) b.line(t.org.legal_name);
            break;
          case "nit":
            if (t.org.nit) b.line(`NIT ${t.org.nit}`);
            break;
          case "address":
            if (t.org.address) b.line(t.org.address);
            break;
          case "phone":
            if (t.org.phone) b.line(`Tel: ${t.org.phone}`);
            break;
          case "email":
            // TicketOrgInfo no expone email aún; placeholder seguro.
            break;
        }
      }
      b.align("left");
      return;
    }
    case "order_meta": {
      b.align("left");
      for (const field of s.fields) {
        switch (field) {
          case "order_number":
            if (t.ticket_number != null) b.line(`Ticket #${t.ticket_number}`);
            break;
          case "date":
            b.line(`Fecha: ${fmtDate(t.created_at)}`);
            break;
          case "cashier":
            if (t.cashier_name) b.line(`Cajero: ${t.cashier_name}`);
            break;
          case "register":
            // futuro: t.register_name
            break;
          case "channel":
            if (t.sale_mode) b.line(`Modo: ${t.sale_mode}`);
            break;
        }
      }
      return;
    }
    case "customer": {
      if (!t.customer_name && !t.customer_document) return;
      b.line(`Cliente: ${t.customer_name ?? "Consumidor final"}`);
      if (t.customer_document) b.line(`Doc: ${t.customer_document}`);
      if (t.customer_phone) b.line(`Tel: ${t.customer_phone}`);
      return;
    }
    case "items": {
      const cols = s.columns;
      const showHeader = cols.includes("total") || cols.includes("qty");
      if (showHeader) b.bold(true).twoCol("Producto", cols.includes("total") ? "Total" : "").bold(false);
      for (const it of t.items) {
        const qty = it.quantity % 1 === 0 ? it.quantity.toString() : it.quantity.toFixed(2);
        const namePart = cols.includes("qty")
          ? `${qty} x ${truncate(it.name, width - 12)}`
          : truncate(it.name, width - 12);
        b.twoCol(namePart, cols.includes("total") ? fmtMoney(it.total) : "");
        if (cols.includes("unit") && it.quantity > 1) {
          b.line(`   @ ${fmtMoney(it.unit_price)}`);
        }
        if (s.showModifiers && it.modifiers?.length) {
          for (const m of it.modifiers) {
            b.line(`   + ${m.name}${m.price ? `  ${fmtMoney(m.price)}` : ""}`);
          }
        }
        if (it.notes) b.line(`   * ${it.notes}`);
      }
      return;
    }
    case "totals": {
      b.twoCol("Subtotal", fmtMoney(t.subtotal));
      if (s.showDiscount && t.discount > 0) b.twoCol("Descuento", `-${fmtMoney(t.discount)}`);
      if (s.showTax && t.tax > 0) b.twoCol("IVA", fmtMoney(t.tax));
      if (s.showTip && t.tip > 0) b.twoCol("Propina", fmtMoney(t.tip));
      b.bold(true).size(2, 1).twoCol("TOTAL", fmtMoney(t.total)).size(1).bold(false);
      return;
    }
    case "payments": {
      if (!t.payments?.length) return;
      for (const p of t.payments) b.twoCol(p.method.toUpperCase(), fmtMoney(p.amount));
      b.twoCol("Recibido", fmtMoney(t.amount_paid));
      if (t.change_due > 0) b.twoCol("Cambio", fmtMoney(t.change_due));
      return;
    }
    case "qr": {
      const payload = t.qr_payload;
      if (!payload) return;
      b.align("center").qr(payload, paperMm === 58 ? 5 : 6);
      b.line();
      b.align("left");
      return;
    }
    case "divider": {
      b.separator(s.char);
      return;
    }
    case "text": {
      if (!s.value) return;
      b.align("center").line(s.value).align("left");
      return;
    }
  }
}
