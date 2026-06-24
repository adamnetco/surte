/**
 * Generador de Reporte UIAF en formato XML para Casas de Cambio.
 *
 * Estructura inspirada en la Resolución UIAF 285/2007 (Formato de Reporte de
 * Operaciones de Cambio). El esquema oficial puede requerir ajustes finos por
 * cada entidad reportante; este builder cubre los campos obligatorios y deja
 * los opcionales como elementos vacíos cuando no aplica, manteniendo el XML
 * válido y trazable.
 */

type FxTx = Record<string, any>;
type CurrencyMap = Record<string, { code: string; name: string }>;

export type UiafReportMeta = {
  organizationName: string;
  organizationLegalName?: string | null;
  organizationTaxId?: string | null;
  year: number;
  month: number; // 1-12
};

function xmlEscape(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name: string, value: any, attrs?: Record<string, string>): string {
  const a = attrs
    ? " " +
      Object.entries(attrs)
        .map(([k, v]) => `${k}="${xmlEscape(v)}"`)
        .join(" ")
    : "";
  const v = value === null || value === undefined || value === "" ? "" : xmlEscape(value);
  return v === "" ? `<${name}${a}/>` : `<${name}${a}>${v}</${name}>`;
}

function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function fmtAmount(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toFixed(2);
}

function fmtRate(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toFixed(6);
}

export function buildUiafXml(
  txs: FxTx[],
  currencies: CurrencyMap,
  meta: UiafReportMeta,
): string {
  const periodo = `${meta.year}-${String(meta.month).padStart(2, "0")}`;
  const generatedAt = new Date().toISOString();

  const operaciones = txs
    .map((t, idx) => {
      const fromCode = currencies[t.from_currency_id]?.code ?? "";
      const toCode = currencies[t.to_currency_id]?.code ?? "";
      const cliente = [
        tag("TipoDocumento", t.customer_doc_type ?? ""),
        tag("NumeroDocumento", t.customer_doc_number ?? ""),
        tag("Nombre", t.customer_name ?? ""),
        tag("Direccion", t.customer_address ?? ""),
        tag("Ocupacion", t.customer_occupation ?? ""),
        tag("OrigenFondos", t.funds_origin ?? ""),
      ].join("");

      return [
        `<Operacion numero="${idx + 1}">`,
        tag("Fecha", fmtDate(t.created_at)),
        tag("NumeroRecibo", t.receipt_number ?? ""),
        tag("TipoOperacion", t.operation ?? ""),
        tag("MonedaEntregada", fromCode),
        tag("MontoEntregado", fmtAmount(t.from_amount)),
        tag("MonedaRecibida", toCode),
        tag("MontoRecibido", fmtAmount(t.to_amount)),
        tag("TasaAplicada", fmtRate(t.rate_applied)),
        tag("SuperaUmbral", t.is_above_threshold ? "S" : "N"),
        tag("Sospechosa", t.is_suspicious ? "S" : "N"),
        tag("MotivoROS", t.ros_reason ?? ""),
        `<Cliente>${cliente}</Cliente>`,
        `</Operacion>`,
      ].join("");
    })
    .join("");

  const totalOps = txs.length;
  const totalUmbral = txs.filter((t) => t.is_above_threshold).length;
  const totalRos = txs.filter((t) => t.is_suspicious).length;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ReporteUIAF version="1.0" tipo="OperacionesCambio">',
    `<Encabezado>`,
    tag("EntidadReportante", meta.organizationLegalName ?? meta.organizationName),
    tag("NIT", meta.organizationTaxId ?? ""),
    tag("Periodo", periodo),
    tag("FechaGeneracion", generatedAt),
    tag("TotalOperaciones", String(totalOps)),
    tag("TotalSobreUmbral", String(totalUmbral)),
    tag("TotalROS", String(totalRos)),
    `</Encabezado>`,
    `<Operaciones>`,
    operaciones,
    `</Operaciones>`,
    `</ReporteUIAF>`,
  ].join("\n");
}

export function downloadXml(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
