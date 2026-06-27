import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./OrganizationContext";

export interface Location {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  is_main: boolean;
  is_active: boolean;
}

interface LocationContextValue {
  loading: boolean;
  locations: Location[];
  currentLocation: Location | null;
  /** id "all" indica vista consolidada (todas las sucursales). */
  currentLocationId: string | "all";
  setCurrentLocationId: (id: string | "all") => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "sistecpos:currentLocationId";

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentLocationId, setCurrentLocationIdState] = useState<string | "all">(
    () => (typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as string) : null) ?? "all"
  );

  const load = useCallback(async () => {
    if (!currentOrg) {
      setLocations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Filtra por sucursales permitidas al miembro actual (owners/admins ven todas)
      const allowed = await supabase.rpc("member_allowed_locations" as any, { _org_id: currentOrg.id });
      const allowedIds: string[] | null = Array.isArray(allowed.data)
        ? (allowed.data as any[]).map((r) => (typeof r === "string" ? r : r.member_allowed_locations ?? r.id)).filter(Boolean)
        : null;

      let query = supabase
        .from("locations")
        .select("id, name, code, city, is_main, is_active")
        .eq("organization_id", currentOrg.id)
        .eq("is_active", true)
        .order("is_main", { ascending: false })
        .order("name");
      if (allowedIds && allowedIds.length > 0) {
        query = query.in("id", allowedIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      setLocations((data as Location[]) ?? []);
    } finally {
      setLoading(false);
    }

  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const setCurrentLocationId = useCallback((id: string | "all") => {
    setCurrentLocationIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const currentLocation = useMemo(
    () => (currentLocationId === "all" ? null : locations.find((l) => l.id === currentLocationId) ?? null),
    [locations, currentLocationId]
  );

  const value = useMemo<LocationContextValue>(
    () => ({ loading, locations, currentLocation, currentLocationId, setCurrentLocationId, refresh: load }),
    [loading, locations, currentLocation, currentLocationId, setCurrentLocationId, load]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
