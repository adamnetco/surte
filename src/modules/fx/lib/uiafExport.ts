/**
 * Generador de archivo plano UIAF (Reporte de Operaciones en Efectivo - Casas de Cambio).
 *
 * Formato simplificado tipo CSV — el formato oficial UIAF (XML/TXT posicional) puede
 * generarse a partir de este dataset cuando el cliente lo requiera. Lo importante
 * es que toda la información necesaria queda exportable y trazable.
 */

type FxTx = Record<string, any>;
type CurrencyMap = Record<string, { code: string; name: string }>;

const HEADERS = [
  "fecha",
  "numero_recibo",
  "tipo_operacion",
  "moneda_entregada",
  "monto_entregado",
  "moneda_recibida",
  "monto_recibido",
  "tasa_aplicada",
  "supera_umbral",
  "sospechosa",
  "cliente_tipo_doc",
  "cliente_doc",
  "cliente_nombre",
  "cliente_direccion",
  "cliente_ocupacion",
  "origen_fondos",
  "motivo_ros",
];

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildUiafCsv(txs: FxTx[], currencies: CurrencyMap): string {
  const lines = [HEADERS.join(",")];
  for (const t of txs) {
    const from = currencies[t.from_currency_id]?.code ?? t.from_currency_id;
    const to = currencies[t.to_currency_id]?.code ?? t.to_currency_id;
    lines.push(
      [
        new Date(t.created_at).toISOString(),
        t.receipt_number ?? "",
        t.operation,
        from,
        t.from_amount,
        to,
        t.to_amount,
        t.rate_applied,
        t.is_above_threshold ? "SI" : "NO",
        t.is_suspicious ? "SI" : "NO",
        t.customer_doc_type ?? "",
        t.customer_doc_number ?? "",
        t.customer_name ?? "",
        t.customer_address ?? "",
        t.customer_occupation ?? "",
        t.funds_origin ?? "",
        t.ros_reason ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
