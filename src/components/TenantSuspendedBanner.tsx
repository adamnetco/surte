import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useSupportContact } from "@/lib/support";

/**
 * Banner global no descartable que se muestra cuando la tienda actual
 * está en estado `suspended` o `archived`. El enforcement real ocurre en DB
 * (trigger `enforce_tenant_writable`); este banner solo comunica el bloqueo.
 *
 * Se oculta para superadmins (ellos pueden seguir operando vía bypass).
 */
export default function TenantSuspendedBanner() {
  const { currentOrg } = useOrganization();
  const { role } = useAuth();
  const support = useSupportContact();

  const { data: state } = useQuery({
    queryKey: ["org-lifecycle", currentOrg?.id],
    enabled: !!currentOrg?.id && role !== "superadmin",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("lifecycle_state")
        .eq("id", currentOrg!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.lifecycle_state as string | null) ?? null;
    },
  });

  if (role === "superadmin") return null;
  if (state !== "suspended" && state !== "archived") return null;

  const isSuspended = state === "suspended";
  const label = isSuspended ? "suspendida" : "archivada";
  const accent = isSuspended
    ? "bg-amber-50 border-amber-300 text-amber-900"
    : "bg-red-50 border-red-300 text-red-900";

  return (
    <div
      role="alert"
      className={`sticky top-0 z-50 border-b ${accent}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 leading-tight">
          <span className="font-semibold">Tu tienda está {label}.</span>{" "}
          <span className="hidden sm:inline">
            No podrás crear ni modificar registros hasta que sea reactivada.
          </span>
        </p>
        <a
          href={support.waUrl("Hola, mi tienda está bloqueada y necesito reactivarla.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md bg-white/80 hover:bg-white px-3 py-1.5 text-xs font-medium border border-current/30 transition-colors"
        >
          Contactar soporte
        </a>
      </div>
    </div>
  );
}
