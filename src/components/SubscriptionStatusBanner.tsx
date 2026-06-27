import { Link } from "react-router-dom";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useEntitlements, trialDaysLeft } from "@/lib/entitlements/useEntitlements";

/**
 * Banner global de estado de suscripción.
 * Sólo se renderiza cuando hay una condición que mostrar (trial por vencer, past_due, canceled).
 */
export function SubscriptionStatusBanner() {
  const { currentOrg } = useOrganization();
  const { data: ent } = useEntitlements(currentOrg?.id);
  if (!ent) return null;

  // 1) Trial activo
  if (ent.status === "trialing") {
    const days = trialDaysLeft(ent);
    if (days == null || days > 7) return null; // sólo recordamos en la última semana
    return (
      <Banner tone={days <= 2 ? "danger" : "warn"} icon={<Clock className="w-4 h-4" />}>
        Tu prueba gratuita termina en <strong>{days} día{days === 1 ? "" : "s"}</strong>.{" "}
        <Link to="/planes" className="underline font-semibold">Activa tu plan</Link>
      </Banner>
    );
  }

  // 2) Pago vencido (en período de gracia)
  if (ent.status === "past_due") {
    return (
      <Banner tone="warn" icon={<AlertTriangle className="w-4 h-4" />}>
        Tu último pago no se procesó. Estamos reintentando.{" "}
        <Link to="/billing" className="underline font-semibold">Actualizar método de pago</Link>
      </Banner>
    );
  }

  // 3) Cancelación programada
  if (ent.cancel_at_period_end && ent.current_period_end) {
    const d = new Date(ent.current_period_end).toLocaleDateString();
    return (
      <Banner tone="info" icon={<Clock className="w-4 h-4" />}>
        Tu suscripción se cancelará el <strong>{d}</strong>.{" "}
        <Link to="/billing" className="underline font-semibold">Reactivar</Link>
      </Banner>
    );
  }

  // 4) Cancelada / sin suscripción
  if (ent.status === "canceled" || (ent.status === "none" && ent.plan_key !== "free")) {
    return (
      <Banner tone="danger" icon={<XCircle className="w-4 h-4" />}>
        Tu suscripción está inactiva. Algunas funciones están bloqueadas.{" "}
        <Link to="/planes" className="underline font-semibold">Ver planes</Link>
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone, icon, children,
}: { tone: "info" | "warn" | "danger"; icon: React.ReactNode; children: React.ReactNode }) {
  const toneClasses = {
    info: "bg-blue-50 text-blue-900 border-blue-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-red-50 text-red-900 border-red-200",
  }[tone];
  return (
    <div className={`w-full border-b px-4 py-2 text-xs sm:text-sm flex items-center gap-2 ${toneClasses}`}>
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
