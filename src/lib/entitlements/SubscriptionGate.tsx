import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Lock, AlertTriangle } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useEntitlements, trialDaysLeft } from "@/lib/entitlements/useEntitlements";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Props = {
  children: ReactNode;
  /** Si true, también bloquea cuando status='past_due'. Default false (sólo advierte). */
  blockPastDue?: boolean;
  /** Bypass para roles plataforma. Default ['superadmin']. */
  bypassRoles?: string[];
  /** Redirige a /planes en vez de mostrar pantalla bloqueada. Default true. */
  redirect?: boolean;
};

/**
 * SubscriptionGate — Bloqueo duro de rutas críticas cuando la suscripción no está activa.
 * - Permite acceso si: status ∈ {active, trialing} ó override de superadmin.
 * - Bloquea si: status ∈ {none, canceled, incomplete_expired, paused, pending}.
 * - past_due: pasa con banner global (a menos que blockPastDue=true).
 */
export function SubscriptionGate({
  children,
  blockPastDue = false,
  bypassRoles = ["superadmin"],
  redirect = true,
}: Props) {
  const { currentOrg } = useOrganization();
  const { role } = useAuth();
  const location = useLocation();
  const { data: ent, isLoading } = useEntitlements(currentOrg?.id);

  if (role && bypassRoles.includes(role)) return <>{children}</>;
  if (isLoading || !ent) return null;

  const status = ent.status;
  const isAllowed =
    status === "active" ||
    status === "trialing" ||
    (status === "past_due" && !blockPastDue);

  if (isAllowed) return <>{children}</>;

  if (redirect) {
    return (
      <Navigate
        to={`/planes?reason=${status}&return_to=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <BlockedScreen status={status} trialLeft={trialDaysLeft(ent)} />;
}

function BlockedScreen({ status, trialLeft }: { status: string; trialLeft: number | null }) {
  const titles: Record<string, string> = {
    none: "No tienes una suscripción activa",
    canceled: "Tu suscripción fue cancelada",
    incomplete_expired: "El pago inicial no se completó",
    paused: "Tu suscripción está pausada",
    pending: "Tu suscripción está pendiente de pago",
    past_due: "Pago vencido",
  };
  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md w-full text-center border border-border rounded-2xl bg-card p-6 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          {status === "past_due" ? <AlertTriangle size={20} /> : <Lock size={20} />}
        </div>
        <h2 className="font-heading font-bold text-lg mb-1">
          {titles[status] ?? "Acceso restringido"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {trialLeft === 0
            ? "Tu período de prueba ha finalizado. Activa un plan para seguir operando."
            : "Activa o renueva tu plan para acceder a la administración."}
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link to="/planes">Ver planes</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/billing">Ir a Facturación</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionGate;
