// Mirror de supabase/functions/innapsis-emit/buildXml.ts para previsualización en UI.
// Mantén ambos archivos sincronizados ante cambios de spec Innapsis v1.9.

const SECTION_ORDER = [
  "Encabezado",
  "CondicionesDePago",
  "Emisor",
  "Receptor",
  "Referencia",
  "Totales",
  "TaxTotal",
  "Detalles",
  "Adicionales",
];

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function renderValue(tag: string, value: unknown, indent: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((v) => renderValue(tag, v, indent)).join("");
  }
  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => renderValue(k, v, indent + "  "))
      .join("");
    return `${indent}<${tag}>\n${inner}${indent}</${tag}>\n`;
  }
  return `${indent}<${tag}>${escapeXml(String(value))}</${tag}>\n`;
}

export function feToXmlPreview(payload: { trackId?: string; Fe?: Record<string, unknown> } | null | undefined): string {
  if (!payload || !payload.Fe) return "";
  const trackId = payload.trackId ?? "";
  const fe = payload.Fe;
  const keys = [
    ...SECTION_ORDER.filter((k) => k in fe),
    ...Object.keys(fe).filter((k) => !SECTION_ORDER.includes(k)),
  ];
  const inner = keys.map((k) => renderValue(k, (fe as any)[k], "    ")).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Fe trackId="${escapeXml(trackId)}">\n${inner}</Fe>\n`;
}
