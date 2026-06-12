import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";

export type OrgRole = "owner" | "admin" | "manager" | "cashier" | "waiter" | "kitchen" | "agent" | "member";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  role: OrgRole;
}

export interface OrganizationModule {
  module_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  expires_at: string | null;
}

interface OrganizationContextValue {
  loading: boolean;
  orgs: Organization[];
  currentOrg: Organization | null;
  modules: OrganizationModule[];
  hasModule: (key: string) => boolean;
  switchOrg: (orgId: string) => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "sistecpos:currentOrgId";
const LEGACY_STORAGE_KEY = "surteya:currentOrgId";

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
  );
  const [modules, setModules] = useState<OrganizationModule[]>([]);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        setOrgs([]);
        setModules([]);
        return;
      }
      let list: Organization[] = [];
      if (role === "superadmin") {
        // Superadmin ve TODAS las organizaciones activas, no solo las suyas.
        const { data, error } = await supabase
          .from("organizations")
          .select("id, slug, name")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        list = (data ?? []).map((o: any) => ({
          id: o.id,
          slug: o.slug,
          name: o.name,
          role: "owner" as OrgRole,
        }));
      } else {
        const { data, error } = await supabase.rpc("user_orgs", { _user_id: user.id });
        if (error) throw error;
        list = (data ?? []).map((r: any) => ({
          id: r.organization_id,
          slug: r.slug,
          name: r.name,
          role: r.role,
        }));
      }
      setOrgs(list);
      setCurrentOrgId((prev) => (list.length > 0 && (!prev || !list.find((o) => o.id === prev)) ? list[0].id : prev));
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  const loadModules = useCallback(async (orgId: string) => {
    const { data, error } = await supabase
      .from("organization_modules")
      .select("module_key, enabled, config, expires_at")
      .eq("organization_id", orgId);
    if (!error && data) setModules(data as OrganizationModule[]);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem(STORAGE_KEY, currentOrgId);
      loadModules(currentOrgId);
    }
  }, [currentOrgId, loadModules]);

  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === currentOrgId) ?? null,
    [orgs, currentOrgId]
  );

  // Perf: hasModule debe ser estable entre renders para no invalidar memos
  // de consumidores (PosHub, AdminDashboard, etc.) en cada render del provider.
  //
  // Compatibilidad de claves: el wizard de onboarding inserta claves genéricas
  // (`pos`, `mesas`) mientras que ciertas rutas de código piden claves
  // específicas (`pos_counter`, `tables`). Sin un alias el usuario veía
  // "Módulo POS no activo" justo después de crear la tienda.
  // Mantener este mapa centralizado evita migraciones de datos.
  const MODULE_ALIASES: Record<string, string[]> = {
    pos_counter: ["pos", "pos_counter", "caja"],
    tables: ["tables", "mesas"],
    kds: ["kds", "kitchen"],
    inventory: ["inventory", "inventario"],
  };

  const hasModule = useCallback(
    (key: string) => {
      const aliases = MODULE_ALIASES[key] ?? [key];
      const m = modules.find((x) => aliases.includes(x.module_key));
      if (!m || !m.enabled) return false;
      if (m.expires_at && new Date(m.expires_at) < new Date()) return false;
      return true;
    },
    [modules]
  );

  const switchOrg = useCallback((id: string) => setCurrentOrgId(id), []);

  // Perf: memoizar el value del Provider evita que TODOS los consumidores
  // re-rendericen en cada render del padre (problema típico de Context).
  const value = useMemo<OrganizationContextValue>(
    () => ({
      loading,
      orgs,
      currentOrg,
      modules,
      hasModule,
      switchOrg,
      refresh: loadOrgs,
    }),
    [loading, orgs, currentOrg, modules, hasModule, switchOrg, loadOrgs]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}

export function useModule(key: string) {
  const { hasModule } = useOrganization();
  return hasModule(key);
}
