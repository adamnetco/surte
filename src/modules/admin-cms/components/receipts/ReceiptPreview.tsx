import { useMemo } from "react";
import type { ReceiptTemplate } from "../../hooks/usePosReceiptTemplates";
import type { MockOrder } from "../../lib/receiptMockData";

const COL = 32; // approx chars for 80mm @ 10pt mono
const colFor = (mm: number) => (mm === 58 ? 24 : 32);

function line(width: number, ch = "-") {
  return ch.repeat(width);
}
function pad(left: string, right: string, width: number) {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}
function money(n: number) {
  return "$" + n.toLocaleString("es-CO");
}
function center(text: string, width: number) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

interface Props {
  template: ReceiptTemplate;
  order: MockOrder;
}

export function ReceiptPreview({ template, order }: Props) {
  const width = useMemo(() => colFor(template.paper_width_mm), [template.paper_width_mm]);
  const sections = (template.layout?.sections ?? []) as any[];

  const rendered = sections
    .filter((s) => s.visible !== false)
    .map((s, idx) => {
      switch (s.type) {
        case "logo":
          return template.show_logo ? (
            <div key={s.id ?? idx} className="text-center font-bold tracking-tight">[ LOGO ]</div>
          ) : null;
        case "store_info": {
          const lines: string[] = [];
          const f = s.fields ?? ["name", "nit", "address", "phone"];
          if (f.includes("name")) lines.push(center(order.store.name, width));
          if (f.includes("nit") && template.show_nit) lines.push(center(order.store.nit, width));
          if (f.includes("address")) lines.push(center(order.store.address, width));
          if (f.includes("phone")) lines.push(center(order.store.phone, width));
          if (f.includes("email")) lines.push(center(order.store.email, width));
          return (
            <pre key={s.id ?? idx} className="whitespace-pre">
              {lines.join("\n")}
            </pre>
          );
        }
        case "divider":
          return <pre key={s.id ?? idx} className="whitespace-pre">{line(width, s.char ?? "-")}</pre>;
        case "order_meta": {
          const f = s.fields ?? ["order_number", "date", "cashier"];
          const rows: string[] = [];
          if (f.includes("order_number")) rows.push(pad("Orden:", order.order_number, width));
          if (f.includes("date")) rows.push(pad("Fecha:", order.date, width));
          if (f.includes("cashier")) rows.push(pad("Cajero:", order.cashier, width));
          if (f.includes("register")) rows.push(pad("Caja:", order.register, width));
          if (f.includes("channel")) rows.push(pad("Canal:", order.channel, width));
          return <pre key={s.id ?? idx} className="whitespace-pre">{rows.join("\n")}</pre>;
        }
        case "customer":
          return (
            <pre key={s.id ?? idx} className="whitespace-pre">
              {`Cliente: ${order.customer.name}\n${order.customer.document ?? ""}`}
            </pre>
          );
        case "items": {
          const showMods = s.showModifiers !== false;
          const rows: string[] = [];
          for (const it of order.items) {
            const qty = String(it.qty).padEnd(3);
            const total = money(it.total);
            const nameMax = width - qty.length - total.length - 1;
            const name = it.name.length > nameMax ? it.name.slice(0, nameMax - 1) + "…" : it.name.padEnd(nameMax);
            rows.push(`${qty}${name} ${total}`);
            if (showMods && it.modifiers) for (const m of it.modifiers) rows.push("   " + m);
          }
          return <pre key={s.id ?? idx} className="whitespace-pre">{rows.join("\n")}</pre>;
        }
        case "totals": {
          const rows: string[] = [];
          rows.push(pad("Subtotal", money(order.subtotal), width));
          if (s.showDiscount !== false && order.discount > 0) rows.push(pad("Descuento", "-" + money(order.discount), width));
          if (s.showTax !== false && order.tax > 0) rows.push(pad("IVA", money(order.tax), width));
          if (s.showTip !== false && order.tip > 0) rows.push(pad("Propina", money(order.tip), width));
          rows.push(line(width, "="));
          rows.push(pad("TOTAL", money(order.total), width));
          return <pre key={s.id ?? idx} className="whitespace-pre font-bold">{rows.join("\n")}</pre>;
        }
        case "payments": {
          const rows = order.payments.map((p) => pad(p.method, money(p.amount), width));
          return <pre key={s.id ?? idx} className="whitespace-pre">{rows.join("\n")}</pre>;
        }
        case "qr":
          return template.show_qr_pago ? (
            <div key={s.id ?? idx} className="text-center my-2">
              <div className="inline-block border border-foreground p-3 text-[10px] leading-tight">[QR]<br/>{order.qr_url}</div>
            </div>
          ) : null;
        case "text":
          return (
            <pre key={s.id ?? idx} className="whitespace-pre text-center">
              {center(s.value ?? template.footer_text ?? "", width)}
            </pre>
          );
        case "station_header": {
          const f = s.fields ?? ["station", "table", "time"];
          const rows: string[] = [];
          if (f.includes("station") && order.station) rows.push(center(`** ${order.station} **`, width));
          if (f.includes("table") && order.table) rows.push(pad("Mesa:", order.table, width));
          if (f.includes("time") && order.time) rows.push(pad("Hora:", order.time, width));
          if (f.includes("channel")) rows.push(pad("Canal:", order.channel, width));
          if (f.includes("cashier")) rows.push(pad("Cajero:", order.cashier, width));
          return (
            <pre key={s.id ?? idx} className="whitespace-pre font-bold" style={{ fontSize: "1.2em" }}>
              {rows.join("\n")}
            </pre>
          );
        }
        case "kitchen_items": {
          const showMods = s.showModifiers !== false;
          const showNotes = s.showNotes !== false;
          const rows: string[] = [];
          for (const it of order.items) {
            rows.push(`${it.qty}x ${it.name.toUpperCase()}`);
            if (showMods && it.modifiers) for (const m of it.modifiers) rows.push("   » " + m);
            if (showNotes && it.notes) rows.push("   ! " + it.notes);
          }
          return (
            <pre
              key={s.id ?? idx}
              className="whitespace-pre font-bold"
              style={s.bigFont !== false ? { fontSize: "1.35em", lineHeight: 1.3 } : undefined}
            >
              {rows.join("\n")}
            </pre>
          );
        }
        case "void_notice": {
          const rows: string[] = [];
          rows.push(center("*** ANULACIÓN ***", width));
          rows.push("");
          if (order.original_order) rows.push(pad("Orden orig.:", order.original_order, width));
          if (s.showReason !== false && order.void_reason) {
            rows.push("Motivo:");
            rows.push(order.void_reason);
          }
          if (s.showFiscalHash !== false && order.fiscal_hash) {
            rows.push("");
            rows.push(pad("Hash:", order.fiscal_hash, width));
          }
          return (
            <pre key={s.id ?? idx} className="whitespace-pre font-bold">
              {rows.join("\n")}
            </pre>
          );
        }
        default:
          return null;
      }
    });

  return (
    <div
      className="bg-white text-black mx-auto shadow-xl rounded-sm border border-border"
      style={{
        width: template.paper_width_mm === 58 ? 220 : 302,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: `${template.font_size_pt}pt`,
        padding: "12px 10px",
        lineHeight: 1.25,
      }}
      aria-label="Vista previa del recibo"
    >
      {template.header_text && (
        <pre className="whitespace-pre text-center font-bold">
          {center(template.header_text, width)}
        </pre>
      )}
      {rendered}
    </div>
  );
}
