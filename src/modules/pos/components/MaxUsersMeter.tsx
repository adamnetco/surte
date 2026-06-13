import { useLimit } from "@/lib/entitlements/hooks";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Users } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Indicador compacto de uso vs cupo del límite max_users.
 * Demo de Fase 2 — runtime gating con entitlements resueltos en cliente.
 */
export default function MaxUsersMeter({ className = "" }: { className?: string }) {
  const { currentOrg } = useOrganization();
  const { limit, loading } = useLimit(currentOrg?.id, "max_users");

  if (loading || !limit) return null;
  const { used, value, remaining } = limit;
  if (value == null) {
    return (
      <div className={`text-[11px] text-muted-foreground ${className}`}>
        <Users className="w-3 h-3 inline mr-1" />{used} usuarios · ilimitado
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / value) * 100));
  const tone =
    pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          Usuarios activos
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {used}/{value}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {remaining !== null && remaining <= 1 && (
        <Link to="/planes" className="block mt-1.5 text-[11px] font-medium text-primary hover:underline">
          {remaining === 0 ? "Cupo agotado · mejorar plan →" : "Último cupo disponible · mejorar plan →"}
        </Link>
      )}
    </div>
  );
}
