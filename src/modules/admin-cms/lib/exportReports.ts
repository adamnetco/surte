import * as XLSX from "xlsx";
import type {
  SalesBucket,
  TopProduct,
  PaymentSlice,
  CashierRow,
  Granularity,
} from "../hooks/useSalesReport";

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  credit: "Crédito",
  other: "Otro",
};

function fmtBucketISO(iso: string, g: Granularity): string {
  const d = new Date(iso);
  if (g === "hour") return d.toISOString().slice(0, 16).replace("T", " ");
  if (g === "month") return d.toISOString().slice(0, 7);
  return d.toISOString().slice(0, 10);
}

export interface ExportPayload {
  orgName: string;
  rangeLabel: string;
  from: Date;
  to: Date;
  granularity: Granularity;
  buckets: SalesBucket[];
  topProducts: TopProduct[];
  paymentMix: PaymentSlice[];
  cashiers: CashierRow[];
}

function buildSummaryRows(p: ExportPayload) {
  return p.buckets.map((b) => ({
    Periodo: fmtBucketISO(b.bucket, p.granularity),
    Bruto: b.gross,
    Neto: b.net,
    Impuestos: b.tax,
    Descuentos: b.discount,
    Devoluciones: b.refunds,
    Tickets: b.tickets,
    Unidades: b.units,
  }));
}

function buildTopRows(p: ExportPayload) {
  return p.topProducts.map((r, i) => ({
    "#": i + 1,
    Producto: r.product_name,
    SKU: r.sku ?? "",
    Unidades: r.units,
    Bruto: r.gross,
    Tickets: r.tickets,
  }));
}

function buildPaymentRows(p: ExportPayload) {
  const total = p.paymentMix.reduce((a, b) => a + b.amount, 0) || 1;
  return p.paymentMix.map((r) => ({
    Método: METHOD_LABEL[r.method] ?? r.method,
    Monto: r.amount,
    "% Mix": +((r.amount / total) * 100).toFixed(2),
    Transacciones: r.count,
  }));
}

function buildCashierRows(p: ExportPayload) {
  return p.cashiers.map((r, i) => ({
    "#": i + 1,
    Cajero: r.cashier_name,
    Tickets: r.tickets,
    Bruto: r.gross,
    "Ticket promedio": r.avg_ticket,
  }));
}

function fileBase(p: ExportPayload, ext: string) {
  const safe = p.orgName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const f = p.from.toISOString().slice(0, 10);
  const t = p.to.toISOString().slice(0, 10);
  return `reportes-${safe}-${f}_${t}.${ext}`;
}

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportsCsv(p: ExportPayload) {
  const sections: { title: string; rows: Record<string, any>[] }[] = [
    { title: "Evolución de ventas", rows: buildSummaryRows(p) },
    { title: "Top productos", rows: buildTopRows(p) },
    { title: "Mix de pagos", rows: buildPaymentRows(p) },
    { title: "Cajeros", rows: buildCashierRows(p) },
  ];
  const header = [
    `# ${p.orgName}`,
    `# Rango: ${p.rangeLabel} (${p.from.toISOString().slice(0, 10)} → ${p.to.toISOString().slice(0, 10)})`,
    `# Generado: ${new Date().toISOString()}`,
    "",
  ].join("\n");
  const body = sections
    .map((s) => `## ${s.title}\n${toCsv(s.rows) || "(sin datos)"}`)
    .join("\n\n");
  const bom = "\uFEFF";
  downloadBlob(bom + header + body, fileBase(p, "csv"), "text/csv;charset=utf-8;");
}

export function exportReportsXlsx(p: ExportPayload) {
  const wb = XLSX.utils.book_new();

  const meta = [
    ["Organización", p.orgName],
    ["Rango", p.rangeLabel],
    ["Desde", p.from.toISOString().slice(0, 10)],
    ["Hasta", p.to.toISOString().slice(0, 10)],
    ["Granularidad", p.granularity],
    ["Generado", new Date().toISOString()],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Resumen");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummaryRows(p)), "Evolución");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildTopRows(p)), "Top productos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildPaymentRows(p)), "Mix de pagos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildCashierRows(p)), "Cajeros");

  XLSX.writeFile(wb, fileBase(p, "xlsx"));
}
