import { useLocation, Link } from "react-router-dom";
import { Globe2, Store, ChevronRight } from "lucide-react";
import { useOrganization } from "@/context/OrganizationContext";
import TenantSwitcher from "./TenantSwitcher";

const LABELS: Record<string, string> = {
  "": "Resumen",
  tiendas: "Tiendas",
  "nueva-tienda": "Nueva tienda",
  sync: "Sincronización",
  datos: "Datos (isla)",

  ajustes: "Ajustes globales",
  modulos: "Módulos",
  fiscal: "Fiscal (DIAN)",
  licencia: "Licencia",
};

export default function SuperadminBreadcrumb() {
  const { pathname } = useLocation();
  const { currentOrg } = useOrganization();

  const parts = pathname.replace(/^\/superadmin\/?/, "").split("/").filter(Boolean);
  const isTenantScoped = parts[0] === "t";
  const tenantSlug = isTenantScoped ? parts[1] : null;
  const sectionKey = isTenantScoped ? parts[2] ?? "" : parts[0] ?? "";
  const sectionLabel = LABELS[sectionKey] ?? "Resumen";

  return (
    <div className="h-12 px-4 lg:px-6 border-b border-border bg-card/60 backdrop-blur flex items-center gap-2 text-sm">
      <Link to="/superadmin" className="text-muted-foreground hover:text-foreground">
        Superadmin
      </Link>

      {isTenantScoped ? (
        <>
          <ChevronRight size={14} className="text-muted-foreground" />
          <Store size={14} className="text-primary" />
          <span className="font-medium">{currentOrg?.name ?? tenantSlug}</span>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="text-foreground">{sectionLabel}</span>
          <span className="ml-auto hidden lg:block w-64">
            <TenantSwitcher compact />
          </span>
        </>
      ) : sectionKey ? (
        <>
          <ChevronRight size={14} className="text-muted-foreground" />
          <Globe2 size={14} className="text-muted-foreground" />
          <span className="text-foreground">{sectionLabel}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Global
          </span>
        </>
      ) : (
        <>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="text-foreground">Resumen SaaS</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Global
          </span>
        </>
      )}
    </div>
  );
}
