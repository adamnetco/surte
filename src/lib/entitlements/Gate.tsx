import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useEntitlements, hasModule } from "@/lib/entitlements/useEntitlements";

type GateProps = {
  /** Clave del módulo (ej. "kds", "tables", "pos_counter") */
  feature: string;
  children: ReactNode;
  /** Si se omite, se muestra una tarjeta "bloqueado" con CTA a planes */
  fallback?: ReactNode;
  /** Bypass para superadmin/admin (default true en cliente B2B) */
  bypassRoles?: string[];
  /** Rol actual (si no se pasa, se ignora el bypass) */
  role?: string | null;
};

/**
 * <Gate feature="kds">...</Gate>
 * Render-gating runtime para Fase 2. Lee entitlements resueltos (plan + overrides)
 * desde useEntitlements y oculta/cambia el árbol según el módulo esté habilitado.
 */
export function Gate({ feature, children, fallback, bypassRoles = ["superadmin", "admin"], role }: GateProps) {
  const { currentOrg } = useOrganization();
  const { data: ent, isLoading } = useEntitlements(currentOrg?.id);

  if (role && bypassRoles.includes(role)) return <>{children}</>;
  if (isLoading || !ent) return null;
  if (hasModule(ent, feature)) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;
  return <GateLockedCard feature={feature} />;
}

export function GateLockedCard({ feature }: { feature: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center">
      <Lock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">Módulo no incluido en tu plan</p>
      <p className="text-xs text-muted-foreground mt-1">
        <code className="font-mono">{feature}</code>
      </p>
      <Link
        to="/planes"
        className="inline-block mt-2 text-xs font-semibold text-primary hover:underline"
      >
        Ver planes y mejorar
      </Link>
    </div>
  );
}
