import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Building2, Rocket, RefreshCw, Database,
  ToggleRight, Receipt, Key, Sparkles, ShieldCheck, LogOut, Globe2, Store, HeartPulse,
} from "lucide-react";
import TenantSwitcher from "./TenantSwitcher";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const GLOBAL_ITEMS = [
  { to: "/superadmin", end: true, label: "Resumen SaaS", icon: BarChart3, desc: "Métricas cross-tenant" },
  { to: "/superadmin/tiendas", label: "Tiendas", icon: Building2, desc: "Gestión de organizaciones" },
  { to: "/superadmin/nueva-tienda", label: "Nueva tienda", icon: Rocket, desc: "Wizard de alta" },
  { to: "/superadmin/datos", label: "Datos / Importar", icon: Database, desc: "Operaciones masivas" },
];

const TENANT_ITEMS = [
  { sub: "", label: "Salud del tenant", icon: HeartPulse, desc: "Estado y completitud" },
  { sub: "modulos", label: "Módulos", icon: ToggleRight, desc: "Habilitar capacidades" },
  { sub: "fiscal", label: "Fiscal (DIAN)", icon: Receipt, desc: "Resolución e impuestos" },
  { sub: "sync", label: "Sincronización", icon: RefreshCw, desc: "WP, WhatsApp, DIAN" },
  { sub: "licencia", label: "Licencia", icon: Key, desc: "Plan y vigencia" },
];

export default function SuperadminSidebar() {
  const { currentOrg } = useOrganization();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tenantBase = currentOrg ? `/superadmin/t/${currentOrg.slug}` : null;
  const inTenantScope = location.pathname.startsWith("/superadmin/t/");

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };

  const itemCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors border-l-2",
      isActive
        ? "border-primary bg-primary/5 text-primary"
        : "border-transparent text-foreground hover:bg-muted/50"
    );

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
          <Sparkles size={16} />
        </div>
        <div className="leading-tight">
          <p className="font-heading font-bold text-sm">SistecPOS</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck size={10} /> Superadmin
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {/* ZONA GLOBAL */}
        <div className="pt-3 pb-1 px-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Globe2 size={11} /> Global
        </div>
        {GLOBAL_ITEMS.map(({ to, end, label, icon: Icon, desc }) => (
          <NavLink key={to} to={to} end={end} className={itemCls}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{desc}</p>
            </div>
          </NavLink>
        ))}

        {/* ZONA POR TIENDA */}
        <div className="mt-4 pt-3 pb-2 px-4 border-t border-border">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            <Store size={11} /> Contexto de tienda
          </div>
          <TenantSwitcher />
        </div>

        {currentOrg ? (
          TENANT_ITEMS.map(({ sub, label, icon: Icon, desc }) => (
            <NavLink key={sub || "health"} to={sub ? `${tenantBase}/${sub}` : tenantBase!} end={!sub} className={itemCls}>
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{desc}</p>
              </div>
            </NavLink>
          ))
        ) : (
          <p className="px-4 py-3 text-[11px] text-muted-foreground">
            Selecciona una tienda para ver su panel de salud y parametrizarla.
          </p>
        )}

        {currentOrg && (
          <div className="px-4 py-3">
            <button
              onClick={() => navigate(`/superadmin/t/${currentOrg.slug}/admin`)}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/50 text-left"
            >
              ↗ Abrir admin de la tienda
            </button>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <button
          onClick={() => navigate("/admin")}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/50"
        >
          ↩ Ir al panel operativo
        </button>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded flex items-center gap-2"
        >
          <LogOut size={12} /> Cerrar sesión
        </button>
      </div>
      {/* Hint about scope to avoid confusion */}
      <div className="px-3 pb-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Globe2 size={10} /> Global</span> aplica a todo el SaaS ·{" "}
        <span className="inline-flex items-center gap-1"><Store size={10} /> Tienda</span> solo a la activa.
      </div>
    </aside>
  );
}
