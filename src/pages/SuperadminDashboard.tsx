import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ToggleRight, Receipt, RefreshCw, Database, Key, BarChart3, Settings, LogOut, Sparkles, ShieldCheck, Rocket } from "lucide-react";
import TenantOnboardingWizard from "@/components/superadmin/TenantOnboardingWizard";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const OverviewTab = lazy(() => import("@/components/admin/OverviewTab"));
const OrganizationsTab = lazy(() => import("@/components/admin/OrganizationsTab"));
const ModulesTab = lazy(() => import("@/components/admin/ModulesTab"));
const FiscalSettingsTab = lazy(() => import("@/components/admin/FiscalSettingsTab"));
const SyncMonitor = lazy(() => import("@/components/admin/SyncMonitor"));
const SyncStatusTable = lazy(() => import("@/components/admin/SyncStatusTable"));
const DeadLetterQueue = lazy(() => import("@/components/admin/DeadLetterQueue"));
const DataManagementTab = lazy(() => import("@/components/admin/DataManagementTab"));
const SettingsTab = lazy(() => import("@/components/admin/SettingsTab"));

type SectionId =
  | "overview"
  | "onboarding"
  | "tiendas"
  | "modulos"
  | "fiscal"
  | "sync"
  | "licencias"
  | "datos"
  | "ajustes";

const SECTIONS: Array<{ id: SectionId; label: string; icon: any; description: string }> = [
  { id: "overview", label: "Resumen SaaS", icon: BarChart3, description: "Métricas cross-tenant" },
  { id: "onboarding", label: "Nueva tienda", icon: Rocket, description: "Wizard de alta atómico" },
  { id: "tiendas", label: "Tiendas", icon: Building2, description: "Gestión de organizaciones" },
  { id: "modulos", label: "Módulos", icon: ToggleRight, description: "Habilitar capacidades por tienda" },
  { id: "fiscal", label: "Fiscal (DIAN)", icon: Receipt, description: "Resoluciones e impuestos" },
  { id: "sync", label: "Sincronización", icon: RefreshCw, description: "WP, WhatsApp, DIAN, outbox" },
  { id: "licencias", label: "Licencias", icon: Key, description: "Planes y vigencias" },
  { id: "datos", label: "Datos / Importar", icon: Database, description: "Operaciones masivas" },
  { id: "ajustes", label: "Ajustes globales", icon: Settings, description: "Configuración del SaaS" },
];

const SuperadminDashboard = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId>("overview");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (role !== "superadmin") {
      toast.error("Solo el superadministrador puede acceder a este panel.");
      navigate("/admin", { replace: true });
    }
  }, [user, role, loading, navigate]);

  if (loading || !user || role !== "superadmin") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-sm text-muted-foreground">
        Verificando acceso…
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const renderSection = () => {
    switch (active) {
      case "overview":
        return <OverviewTab products={[]} orders={[]} />;
      case "onboarding":
        return <TenantOnboardingWizard onCreated={() => setActive("tiendas")} />;
      case "tiendas":
        return <OrganizationsTab />;
      case "modulos":
        return <ModulesTab />;
      case "fiscal":
        return <FiscalSettingsTab />;
      case "sync":
        return (
          <div className="space-y-4">
            <SyncStatusTable />
            <SyncMonitor />
            <DeadLetterQueue />
          </div>
        );
      case "licencias":
        return (
          <div className="p-6 rounded-xl border border-border bg-card">
            <h3 className="font-heading font-bold text-lg mb-1">Gestión de licencias</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Administra planes y vigencias en la vista dedicada.
            </p>
            <button onClick={() => navigate("/licencias")} className="btn-surte text-sm px-4 py-2">
              Abrir Licencias →
            </button>
          </div>
        );
      case "datos":
        return <DataManagementTab />;
      case "ajustes":
        return <SettingsTab settings={[]} queryClient={undefined as any} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col lg:flex-row">
      {/* Sidebar (desktop) */}
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

        <nav className="flex-1 overflow-y-auto py-2">
          {SECTIONS.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                active === id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-transparent text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{description}</p>
              </div>
            </button>
          ))}
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
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden border-b border-border bg-card sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
              <ShieldCheck size={14} />
            </div>
            <span className="font-heading font-bold text-sm">Superadmin</span>
          </div>
          <button onClick={handleSignOut} className="text-xs text-destructive flex items-center gap-1">
            <LogOut size={12} /> Salir
          </button>
        </div>
        <div className="flex overflow-x-auto scrollbar-hide border-t border-border">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 ${
                active === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando módulo…</div>}>
            {renderSection()}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default SuperadminDashboard;
