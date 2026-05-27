import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useOrganization } from "@/context/OrganizationContext";
import { Building2 } from "lucide-react";
import TenantSwitcher from "./TenantSwitcher";

/**
 * Garantiza que haya una tienda seleccionada antes de mostrar pantallas por-tenant.
 * Si la URL trae :slug pero no coincide con currentOrg, sincroniza.
 */
export default function RequireActiveTenant({ children }: { children: React.ReactNode }) {
  const { orgs, currentOrg, switchOrg, loading } = useOrganization();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (loading) return;
    if (slug) {
      const match = orgs.find((o) => o.slug === slug);
      if (match && match.id !== currentOrg?.id) switchOrg(match.id);
    }
  }, [slug, orgs, currentOrg?.id, switchOrg, loading]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Cargando tiendas…</div>;
  }

  // Si hay slug en URL pero no existe → mandar a /superadmin/tiendas
  if (slug && !orgs.find((o) => o.slug === slug)) {
    return <Navigate to="/superadmin/tiendas" replace />;
  }

  // Sin slug y sin tienda activa → pedirla
  if (!slug && !currentOrg) {
    return (
      <div className="max-w-md mx-auto mt-12 border border-dashed border-border rounded-xl p-6 text-center bg-card">
        <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
          <Building2 size={20} />
        </div>
        <h3 className="font-heading font-bold text-lg">Elige una tienda</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Esta sección configura parámetros específicos de una tienda. Selecciona en cuál vas a trabajar.
        </p>
        <div className="text-left"><TenantSwitcher /></div>
      </div>
    );
  }

  return <>{children}</>;
}
