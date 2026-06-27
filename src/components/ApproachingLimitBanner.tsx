import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, X, TrendingUp } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useApproachingLimits, type LimitWarning } from "@/lib/entitlements/useApproachingLimits";
import { buildUpgradeUrl, recommendPlanFor } from "@/lib/entitlements/upgradeRecommendation";
import { logUpgradeClick } from "@/lib/entitlements/logUpgradeClick";

const LIMIT_LABELS: Record<string, string> = {
  max_products: "productos",
  max_users: "usuarios",
  max_locations: "sucursales",
  max_warehouses: "bodegas",
  einvoices_month: "facturas electrónicas este mes",
  api_calls_monthly: "llamadas a la API este mes",
  storage_gb: "almacenamiento (GB)",
};

function labelFor(key: string) {
  return LIMIT_LABELS[key] ?? key.replace(/_/g, " ");
}

/**
 * Banner global que aparece cuando un límite del plan está al 80%+ de consumo.
 * - 80-94% (warn): tono ámbar, CTA "Ver plan".
 * - 95-99% (critical): tono rojo, CTA prominente.
 * - 100% (exceeded): no se muestra aquí (lo cubre el hard-block con toast).
 *
 * Persistencia: el usuario puede descartar por límite+severidad para no ver
 * el mismo aviso repetido en la misma sesión.
 */
export function ApproachingLimitBanner() {
  const { currentOrg } = useOrganization();
  const { warnings } = useApproachingLimits(currentOrg?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(sessionStorage.getItem("approaching_limit_dismissed") ?? "[]"));
    } catch {
      return new Set();
    }
  });

  const candidate = warnings.find(
    (w) => (w.severity === "warn" || w.severity === "critical") && !dismissed.has(`${w.key}:${w.severity}`),
  );
  if (!candidate) return null;

  const isCritical = candidate.severity === "critical";
  const plan = recommendPlanFor({ kind: "limit", key: candidate.key });
  const upgradeUrl = buildUpgradeUrl(
    { kind: "limit", key: candidate.key },
    location.pathname + location.search,
  );

  const dismiss = () => {
    const id = `${candidate.key}:${candidate.severity}`;
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      sessionStorage.setItem("approaching_limit_dismissed", JSON.stringify([...next]));
    } catch {
      /* noop */
    }
  };

  return (
    <div
      role="status"
      className={`w-full border-b px-4 py-2 text-xs sm:text-sm flex items-center gap-3 ${
        isCritical
          ? "bg-red-50 text-red-900 border-red-200"
          : "bg-amber-50 text-amber-900 border-amber-200"
      }`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">
          {candidate.pct}% de tu cupo de {labelFor(candidate.key)}
        </span>{" "}
        <span className="opacity-90">
          ({candidate.used}/{candidate.limit}).{" "}
          {isCritical
            ? "Estás a punto de quedarte sin cupo."
            : "Considera aumentar tu plan antes de quedarte sin cupo."}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          void logUpgradeClick(currentOrg?.id, { kind: "limit", key: candidate.key, from: "banner" });
          navigate(upgradeUrl);
        }}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold shrink-0 ${
          isCritical
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-amber-600 text-white hover:bg-amber-700"
        }`}
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Ver plan {plan.toUpperCase()}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar aviso"
        className="p-1 rounded hover:bg-black/5 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Variante compacta (inline) para mostrar dentro de pantallas específicas. */
export function ApproachingLimitInline({ warning }: { warning: LimitWarning }) {
  const navigate = useNavigate();
  const location = useLocation();
  const upgradeUrl = buildUpgradeUrl(
    { kind: "limit", key: warning.key },
    location.pathname + location.search,
  );
  const tone =
    warning.severity === "critical"
      ? "border-red-300 bg-red-50 text-red-900"
      : warning.severity === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-blue-200 bg-blue-50 text-blue-900";
  return (
    <div className={`rounded-md border px-3 py-2 text-xs flex items-center gap-2 ${tone}`}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">
        {warning.pct}% de {labelFor(warning.key)} ({warning.used}/{warning.limit})
      </span>
      <button
        type="button"
        onClick={() => navigate(upgradeUrl)}
        className="underline font-semibold"
      >
        Mejorar
      </button>
    </div>
  );
}
