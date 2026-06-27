/**
 * upgradeRecommendation — mapea un contexto de bloqueo (limit_key, module_key
 * o subscription_status) al plan mínimo recomendado para resolverlo.
 *
 * Centralizado para que toda denial → /planes apunte al mismo plan.
 * Si en el futuro los planes cambian, sólo se ajusta aquí.
 */

export type GateContext =
  | { kind: "limit"; key: string }
  | { kind: "module"; key: string }
  | { kind: "subscription"; key: string };

const LIMIT_TO_PLAN: Record<string, string> = {
  max_products: "pro",
  max_users: "pro",
  max_locations: "business",
  max_warehouses: "business",
  einvoices_month: "pro",
  api_calls_monthly: "business",
  storage_gb: "business",
};

const MODULE_TO_PLAN: Record<string, string> = {
  pos_counter: "starter",
  pos_tables: "pro",
  kds: "pro",
  inventory_multi_warehouse: "business",
  einvoice_innapsis: "pro",
  reports_advanced: "pro",
  fx_module: "business",
  accounting_module: "business",
  multi_location: "business",
  whatsapp_campaigns: "pro",
};

export function recommendPlanFor(ctx: GateContext): string {
  if (ctx.kind === "limit") return LIMIT_TO_PLAN[ctx.key] ?? "pro";
  if (ctx.kind === "module") return MODULE_TO_PLAN[ctx.key] ?? "pro";
  // subscription expired/past_due/canceled → mismo plan que tenían (no inferible
  // aquí); por defecto sugerimos pro para no quedarse en free.
  return "pro";
}

export function buildUpgradeUrl(ctx: GateContext, returnTo?: string): string {
  const plan = recommendPlanFor(ctx);
  const params = new URLSearchParams({
    highlight: plan,
    reason: ctx.key,
    context: ctx.kind,
  });
  if (returnTo) params.set("return_to", returnTo);
  return `/planes?${params.toString()}`;
}
