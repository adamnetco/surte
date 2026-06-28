import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useNavigate, Navigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/modules/auth/context/AuthContext";
import SuperadminSidebar from "@/modules/superadmin/components/SuperadminSidebar";
import SuperadminBreadcrumb from "@/modules/superadmin/components/SuperadminBreadcrumb";
import TenantSwitcher from "@/modules/superadmin/components/TenantSwitcher";
import RequireActiveTenant from "@/modules/superadmin/components/RequireActiveTenant";
import TenantOnboardingWizard from "@/modules/superadmin/components/TenantOnboardingWizard";

const OverviewTab = lazy(() => import("@/modules/admin-cms/components/OverviewTab"));
const OrganizationsTab = lazy(() => import("@/modules/admin-cms/components/OrganizationsTab"));
const ModulesTab = lazy(() => import("@/modules/admin-cms/components/ModulesTab"));
const FiscalSettingsTab = lazy(() => import("@/modules/admin-cms/components/FiscalSettingsTab"));
const SyncMonitor = lazy(() => import("@/modules/admin-cms/components/SyncMonitor"));
const SyncStatusTable = lazy(() => import("@/modules/admin-cms/components/SyncStatusTable"));
const DeadLetterQueue = lazy(() => import("@/modules/admin-cms/components/DeadLetterQueue"));
const DataManagementTab = lazy(() => import("@/modules/admin-cms/components/DataManagementTab"));
const TenantHealth = lazy(() => import("@/modules/superadmin/components/TenantHealth"));
const TenantDataIsland = lazy(() => import("@/modules/superadmin/components/TenantDataIsland"));
const CloudTasksStatus = lazy(() => import("@/modules/superadmin/pages/CloudTasksStatus"));
const SeguridadAcceso = lazy(() => import("@/modules/superadmin/pages/SeguridadAcceso"));
const CspViolations = lazy(() => import("@/modules/superadmin/pages/CspViolations"));
const TenantLicenseSection = lazy(() => import("@/modules/superadmin/components/TenantLicenseSection"));
const PlansCatalog = lazy(() => import("@/modules/superadmin/pages/PlansCatalog"));
const TenantEntitlements = lazy(() => import("@/modules/superadmin/pages/TenantEntitlements"));
const SoporteConfig = lazy(() => import("@/modules/superadmin/pages/SoporteConfig"));
const CriticalActionsQueue = lazy(() => import("@/modules/superadmin/pages/CriticalActionsQueue"));
const AuditLogViewer = lazy(() => import("@/modules/superadmin/pages/AuditLogViewer"));
const SitiosTenantRoute = lazy(() => import("@/modules/superadmin/pages/SitiosTenantRoute"));
const EinvoiceBulkRetry = lazy(() => import("@/modules/superadmin/pages/EinvoiceBulkRetry"));
const EinvoiceBulkRetryAudit = lazy(() => import("@/modules/superadmin/pages/EinvoiceBulkRetryAudit"));
const DiagnosticoRLS = lazy(() => import("@/modules/superadmin/pages/DiagnosticoRLS"));
const HealthEvents = lazy(() => import("@/modules/superadmin/pages/HealthEvents"));
const DunningPanel = lazy(() => import("@/modules/superadmin/pages/DunningPanel"));
const LifecyclePanel = lazy(() => import("@/modules/superadmin/pages/LifecyclePanel"));
const ReferralsPanel = lazy(() => import("@/modules/superadmin/pages/ReferralsPanel"));

const SyncSection = () => (
  <div className="space-y-4">
    <SyncStatusTable />
    <SyncMonitor />
    <DeadLetterQueue />
  </div>
);

// LicenseSection ahora vive en TenantLicenseSection.tsx (filtrado por tienda activa).

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
        <div className="pl-14 pr-4 py-3 flex items-center justify-between">
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
                <Route path="planes" element={<PlansCatalog />} />
                {/* Datos globales (catálogos base, plantillas) — solo Superadmin master. */}
                <Route path="datos" element={<DataManagementTab />} />
                <Route path="cloud-tareas" element={<CloudTasksStatus />} />
                <Route path="seguridad/acceso" element={<SeguridadAcceso />} />
                <Route path="seguridad/csp" element={<CspViolations />} />
                <Route path="soporte" element={<SoporteConfig />} />
                <Route path="acciones-criticas" element={<CriticalActionsQueue />} />
                <Route path="audit" element={<AuditLogViewer />} />
                <Route path="einvoice-bulk-retry" element={<EinvoiceBulkRetry />} />
                <Route path="einvoice-bulk-retry/auditoria" element={<EinvoiceBulkRetryAudit />} />
                <Route path="diagnostico" element={<DiagnosticoRLS />} />
                <Route path="health" element={<HealthEvents />} />
                <Route path="dunning" element={<DunningPanel />} />
                <Route path="lifecycle" element={<LifecyclePanel />} />

                {/* Redirecciones de rutas globales antiguas → ahora viven por tenant */}
                <Route path="sync" element={<Navigate to="/superadmin/tiendas" replace />} />
                <Route path="ajustes" element={<Navigate to="/superadmin/tiendas" replace />} />


                {/* POR TIENDA (siempre /t/:slug/...) */}
                <Route path="t/:slug" element={<RequireActiveTenant><TenantHealth /></RequireActiveTenant>} />
                <Route path="t/:slug/modulos" element={<RequireActiveTenant><ModulesTab /></RequireActiveTenant>} />
                <Route path="t/:slug/fiscal" element={<RequireActiveTenant><FiscalSettingsTab /></RequireActiveTenant>} />
                <Route path="t/:slug/datos" element={<RequireActiveTenant><TenantDataIsland /></RequireActiveTenant>} />

                <Route path="t/:slug/sync" element={<RequireActiveTenant><SyncSection /></RequireActiveTenant>} />
                <Route path="t/:slug/licencia" element={<RequireActiveTenant><TenantLicenseSection /></RequireActiveTenant>} />
                <Route path="t/:slug/entitlements" element={<RequireActiveTenant><TenantEntitlements /></RequireActiveTenant>} />
                <Route path="t/:slug/sitios" element={<RequireActiveTenant><SitiosTenantRoute /></RequireActiveTenant>} />
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
