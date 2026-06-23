import type { FxFraudAlert } from "../hooks/useFxFraud";

const HEADERS = [
  "id",
  "fecha",
  "regla",
  "severidad",
  "estado",
  "transaccion_id",
  "razon",
  "criterios",
  "revisado_por",
  "revisado_en",
  "notas_revision",
];

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildFraudAlertsCsv(alerts: FxFraudAlert[]): string {
  const rows = alerts.map((a) =>
    [
      a.id,
      a.created_at,
      a.rule_code,
      a.severity,
      a.status,
      a.transaction_id ?? "",
      a.reason,
      a.details ?? {},
      a.reviewed_by ?? "",
      a.reviewed_at ?? "",
      a.review_notes ?? "",
    ]
      .map(escape)
      .join(",")
  );
  return [HEADERS.join(","), ...rows].join("\n");
}

export function downloadFraudAlertsCsv(alerts: FxFraudAlert[], filename = "alertas-anti-fraude.csv") {
  const csv = "\uFEFF" + buildFraudAlertsCsv(alerts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
