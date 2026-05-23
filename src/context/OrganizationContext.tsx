import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const STORAGE_KEY = "surteya:currentOrgId";

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
  );
  const [modules, setModules] = useState<OrganizationModule[]>([]);

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setOrgs([]);
        setModules([]);
        return;
      }
      const { data, error } = await supabase.rpc("user_orgs", { _user_id: user.id });
      if (error) throw error;
      const list: Organization[] = (data ?? []).map((r: any) => ({
        id: r.organization_id,
        slug: r.slug,
        name: r.name,
        role: r.role,
      }));
      setOrgs(list);
      if (list.length > 0 && (!currentOrgId || !list.find((o) => o.id === currentOrgId))) {
        setCurrentOrgId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async (orgId: string) => {
    const { data, error } = await supabase
      .from("organization_modules")
      .select("module_key, enabled, config, expires_at")
      .eq("organization_id", orgId);
    if (!error && data) setModules(data as OrganizationModule[]);
  };

  useEffect(() => {
    loadOrgs();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadOrgs());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem(STORAGE_KEY, currentOrgId);
      loadModules(currentOrgId);
    }
  }, [currentOrgId]);

  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === currentOrgId) ?? null,
    [orgs, currentOrgId]
  );

  const hasModule = (key: string) => {
    const m = modules.find((x) => x.module_key === key);
    if (!m) return false;
    if (!m.enabled) return false;
    if (m.expires_at && new Date(m.expires_at) < new Date()) return false;
    return true;
  };

  return (
    <OrganizationContext.Provider
      value={{
        loading,
        orgs,
        currentOrg,
        modules,
        hasModule,
        switchOrg: setCurrentOrgId as (id: string) => void,
        refresh: loadOrgs,
      }}
    >
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
