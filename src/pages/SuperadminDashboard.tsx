import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useNavigate, Navigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import SuperadminSidebar from "@/components/superadmin/SuperadminSidebar";
import SuperadminBreadcrumb from "@/components/superadmin/SuperadminBreadcrumb";
import TenantSwitcher from "@/components/superadmin/TenantSwitcher";
import RequireActiveTenant from "@/components/superadmin/RequireActiveTenant";
import TenantOnboardingWizard from "@/components/superadmin/TenantOnboardingWizard";

const OverviewTab = lazy(() => import("@/modules/admin-cms/components/OverviewTab"));
const OrganizationsTab = lazy(() => import("@/modules/admin-cms/components/OrganizationsTab"));
const ModulesTab = lazy(() => import("@/modules/admin-cms/components/ModulesTab"));
const FiscalSettingsTab = lazy(() => import("@/modules/admin-cms/components/FiscalSettingsTab"));
const SyncMonitor = lazy(() => import("@/modules/admin-cms/components/SyncMonitor"));
const SyncStatusTable = lazy(() => import("@/modules/admin-cms/components/SyncStatusTable"));
const DeadLetterQueue = lazy(() => import("@/modules/admin-cms/components/DeadLetterQueue"));
const DataManagementTab = lazy(() => import("@/modules/admin-cms/components/DataManagementTab"));
const TenantHealth = lazy(() => import("@/components/superadmin/TenantHealth"));
const TenantDataIsland = lazy(() => import("@/components/superadmin/TenantDataIsland"));

const SyncSection = () => (
  <div className="space-y-4">
    <SyncStatusTable />
    <SyncMonitor />
    <DeadLetterQueue />
  </div>
);

const LicenseSection = () => {
  const navigate = useNavigate();
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
};

const SuperadminDashboard = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

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

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col lg:flex-row">
      <SuperadminSidebar />

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
        <div className="px-4 py-2 border-t border-border">
          <TenantSwitcher compact />
        </div>
      </header>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="hidden lg:block">
          <SuperadminBreadcrumb />
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando módulo…</div>}>
              <Routes>
                {/* GLOBAL */}
                <Route index element={<OverviewTab products={[]} orders={[]} />} />
                <Route path="tiendas" element={<OrganizationsTab />} />
                <Route path="nueva-tienda" element={<TenantOnboardingWizard onCreated={() => navigate("/superadmin/tiendas")} />} />
                {/* Datos globales (catálogos base, plantillas) — solo Superadmin master. */}
                <Route path="datos" element={<DataManagementTab />} />

                {/* Redirecciones de rutas globales antiguas → ahora viven por tenant */}
                <Route path="sync" element={<Navigate to="/superadmin/tiendas" replace />} />
                <Route path="ajustes" element={<Navigate to="/superadmin/tiendas" replace />} />


                {/* POR TIENDA (siempre /t/:slug/...) */}
                <Route path="t/:slug" element={<RequireActiveTenant><TenantHealth /></RequireActiveTenant>} />
                <Route path="t/:slug/modulos" element={<RequireActiveTenant><ModulesTab /></RequireActiveTenant>} />
                <Route path="t/:slug/fiscal" element={<RequireActiveTenant><FiscalSettingsTab /></RequireActiveTenant>} />
                <Route path="t/:slug/datos" element={<RequireActiveTenant><TenantDataIsland /></RequireActiveTenant>} />

                <Route path="t/:slug/sync" element={<RequireActiveTenant><SyncSection /></RequireActiveTenant>} />
                <Route path="t/:slug/licencia" element={<RequireActiveTenant><LicenseSection /></RequireActiveTenant>} />
                <Route path="t/:slug/admin" element={<RequireActiveTenant><AdminRedirect /></RequireActiveTenant>} />

                <Route path="*" element={<Navigate to="/superadmin" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};

const AdminRedirect = () => {
  // Redirección segura al admin de la tienda activa (en este host).
  useEffect(() => {
    window.location.href = "/admin";
  }, []);
  return <div className="p-6 text-sm text-muted-foreground">Abriendo admin de la tienda…</div>;
};

export default SuperadminDashboard;
