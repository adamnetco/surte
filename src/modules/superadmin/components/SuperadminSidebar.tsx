import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {

  BarChart3, Building2, RefreshCw, Database, Package,
  ToggleRight, Receipt, Key, Sparkles, ShieldCheck, LogOut, Globe2, Store, HeartPulse, Zap, MessageCircle, ShieldAlert, ScrollText, FileText, History, Menu, AlertOctagon, Mail,
} from "lucide-react";
import TenantSwitcher from "./TenantSwitcher";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const GLOBAL_ITEMS = [
  { to: "/superadmin", end: true, label: "Resumen SaaS", icon: BarChart3, desc: "Métricas cross-tenant" },
  { to: "/superadmin/tiendas", label: "Tiendas", icon: Building2, desc: "Listado · alta · módulos · estado" },
  { to: "/superadmin/planes", label: "Catálogo de Planes", icon: Package, desc: "Plan × Módulos × Límites" },
  { to: "/superadmin/seguridad/acceso", label: "Acceso & Seguridad", icon: ShieldCheck, desc: "2FA, passkeys, break-glass" },
  { to: "/superadmin/seguridad/csp", label: "CSP Violaciones", icon: ShieldCheck, desc: "Telemetría CSP report-only" },
  { to: "/superadmin/acciones-criticas", label: "Acciones críticas", icon: ShieldAlert, desc: "Cola de co-firma · doble aprobación" },
  { to: "/superadmin/audit", label: "Audit log", icon: ScrollText, desc: "Historial de cambios y overrides" },
  { to: "/superadmin/soporte", label: "WhatsApp soporte", icon: MessageCircle, desc: "Número global de ayuda" },
  { to: "/superadmin/cloud-tareas", label: "Cloud / Tareas", icon: Zap, desc: "Migraciones, seeds, secrets" },
  { to: "/superadmin/einvoice-bulk-retry", label: "Bulk retry DIAN", icon: FileText, desc: "Reenvío masivo multi-tenant" },
  { to: "/superadmin/einvoice-bulk-retry/auditoria", label: "Bulk retry · Auditoría", icon: History, desc: "Idempotency keys · estado · lotes" },
  { to: "/superadmin/diagnostico", label: "Diagnóstico RLS", icon: ShieldAlert, desc: "RLS · GRANTs · políticas por tabla" },
  { to: "/superadmin/health", label: "Salud del sistema", icon: HeartPulse, desc: "Health events · WhatsApp traces" },
  { to: "/superadmin/dunning", label: "Dunning & morosidad", icon: AlertOctagon, desc: "Casos abiertos · recuperación · churn involuntario" },
];

const TENANT_ITEMS = [
  { sub: "", label: "Salud del tenant", icon: HeartPulse, desc: "Estado y completitud" },
  { sub: "modulos", label: "Módulos", icon: ToggleRight, desc: "Habilitar capacidades" },
  { sub: "fiscal", label: "Fiscal (DIAN)", icon: Receipt, desc: "Resolución e impuestos" },
  { sub: "datos", label: "Datos (isla)", icon: Database, desc: "Export/import aislado" },
  { sub: "sync", label: "Sincronización", icon: RefreshCw, desc: "WP, WhatsApp, DIAN" },
  { sub: "licencia", label: "Licencia", icon: Key, desc: "Plan y vigencia" },
  { sub: "entitlements", label: "Anulaciones", icon: ShieldCheck, desc: "Overrides de módulos y límites" },
];

const itemCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors border-l-2",
    isActive
      ? "border-primary bg-primary/5 text-primary"
      : "border-transparent text-foreground hover:bg-muted/50"
  );

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { currentOrg } = useOrganization();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const tenantBase = currentOrg ? `/superadmin/t/${currentOrg.slug}` : null;

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };
  const go = (path: string) => { navigate(path); onNavigate?.(); };

  return (
    <>
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
        <div className="pt-3 pb-1 px-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Globe2 size={11} /> Global
        </div>
        {GLOBAL_ITEMS.map(({ to, end, label, icon: Icon, desc }) => (
          <NavLink key={to} to={to} end={end} className={itemCls} onClick={() => onNavigate?.()}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{desc}</p>
            </div>
          </NavLink>
        ))}

        <div className="mt-4 pt-3 pb-2 px-4 border-t border-border">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            <Store size={11} /> Contexto de tienda
          </div>
          <TenantSwitcher />
        </div>

        {currentOrg ? (
          TENANT_ITEMS.map(({ sub, label, icon: Icon, desc }) => (
            <NavLink key={sub || "health"} to={sub ? `${tenantBase}/${sub}` : tenantBase!} end={!sub} className={itemCls} onClick={() => onNavigate?.()}>
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
              onClick={() => go(`/superadmin/t/${currentOrg.slug}/admin`)}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/50 text-left"
            >
              ↗ Abrir admin de la tienda
            </button>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <button
          onClick={() => go("/admin")}
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
      <div className="px-3 pb-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Globe2 size={10} /> Global</span> aplica a todo el SaaS ·{" "}
        <span className="inline-flex items-center gap-1"><Store size={10} /> Tienda</span> solo a la activa.
      </div>
    </>
  );
}

export default function SuperadminSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Cerrar al cambiar de ruta
  useState(() => location.pathname);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <SidebarBody />
      </aside>

      {/* Mobile/Tablet trigger — flotante en la topbar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menú superadmin"
            className="lg:hidden fixed top-2.5 left-3 z-20 w-9 h-9 rounded-md border border-border bg-card flex items-center justify-center text-foreground shadow-sm"
          >
            <Menu size={18} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[88vw] max-w-[320px] flex flex-col">
          <VisuallyHidden>
            <SheetTitle>Menú Superadmin</SheetTitle>
          </VisuallyHidden>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
