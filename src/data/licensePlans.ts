// Etiquetas legibles para tipos de plan de licencia.
// Stub Fase 2 — se ampliará en Fase 3 con el catálogo real desde DB.
const LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
  enterprise: "Enterprise",
  restobar: "RestoBar",
  retail: "Retail",
  pos_lite: "POS Lite",
};

export function planLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
