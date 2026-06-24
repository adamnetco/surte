// XML builder Fe → string conforme Innapsis FacturaE v1.9.
// Opt-in vía cfg.extra.payload_format = "xml". Default sigue siendo JSON.
//
// Reglas spec (POS-INNAPSIS v1.9):
// - Estructura raíz <Fe>...</Fe> con secciones en orden: Encabezado, CondicionesDePago,
//   Emisor, Receptor, Totales, TaxTotal (n), Detalles (n).
// - Tags self-closing cuando el valor es escalar (<FechaEmision>2026-06-24</FechaEmision>).
// - Arrays (TaxTotal, Detalles) se serializan como tags repetidos.
// - undefined/null se omiten. Booleanos como "true"/"false". Números sin comillas.

const escapeXml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function renderValue(tag: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((v) => renderValue(tag, v)).join("");
  }
  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => renderValue(k, v))
      .join("");
    return `<${tag}>${inner}</${tag}>`;
  }
  return `<${tag}>${escapeXml(value)}</${tag}>`;
}

export function buildFeXml(payload: { trackId: string; Fe: Record<string, unknown> }): string {
  const sectionsOrder = [
    "Encabezado",
    "CondicionesDePago",
    "CondicionesEntrega",
    "LugarEntrega",
    "Divisas",
    "Emisor",
    "OyREmisor",
    "Receptor",
    "ContactoReceptor",
    "OyRReceptor",
    "Mandatos",
    "Transportista",
    "Referencia",
    "Totales",
    "Anticipos",
    "Descuentos",
    "Recargos",
    "TaxTotal",
    "Detalles",
    "Referencias",
    "Adicionales",
    "Salud",
  ];
  const fe = payload.Fe;
  const keysInOrder = sectionsOrder.filter((k) => fe[k] !== undefined);
  const remaining = Object.keys(fe).filter((k) => !sectionsOrder.includes(k));
  const all = [...keysInOrder, ...remaining];
  const inner = all.map((k) => renderValue(k, fe[k])).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Fe trackId="${escapeXml(payload.trackId)}">${inner}</Fe>`;
}
