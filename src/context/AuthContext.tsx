import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "admin" | "editor" | "agente" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isAgent: boolean;
  role: AppRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null }>;
  signUp: (email: string, password: string, fullName: string, businessType?: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_LOOKUP_TIMEOUT_MS = 4000;

const withTimeout = async <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ROLE_LOOKUP_TIMEOUT_MS)),
  ]);

const ROLE_CACHE_PREFIX = "sps_role:";

const readCachedRole = (userId: string | null | undefined): AppRole | null => {
  if (!userId || typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ROLE_CACHE_PREFIX + userId);
  return v && ["superadmin", "admin", "editor", "agente", "user"].includes(v) ? (v as AppRole) : null;
};

const writeCachedRole = (userId: string, role: AppRole) => {
  try { window.localStorage.setItem(ROLE_CACHE_PREFIX + userId, role); } catch { /* quota */ }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  const applyRole = (nextRole: AppRole, userId?: string) => {
    setRole(nextRole);
    setIsAdmin(["superadmin", "admin"].includes(nextRole));
    setIsAgent(nextRole === "agente");
    if (userId) writeCachedRole(userId, nextRole);
  };


  const resetAuthState = () => {
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setIsAgent(false);
    setRole("user");
  };

  const normalizeRole = (value: string | null | undefined): AppRole => {
    const validRoles: AppRole[] = ["superadmin", "admin", "editor", "agente", "user"];
    return validRoles.includes(value as AppRole) ? (value as AppRole) : "user";
  };

  const checkRole = async (userId: string) => {
    // Hydrate from localStorage cache first → kills the "Verificando permisos…" flash.
    const cached = readCachedRole(userId);
    if (cached) applyRole(cached, userId);

    const { data: effectiveRole, error: rpcError } = await withTimeout(
      (supabase as any).rpc("get_current_user_role"),
      { data: null, error: new Error("Role lookup timeout") }
    );

    if (!rpcError && effectiveRole) {
      applyRole(normalizeRole(effectiveRole), userId);
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      if (!cached) applyRole("user", userId);
      return;
    }

    const priority: AppRole[] = ["superadmin", "admin", "editor", "agente", "user"];
    const assignedRoles = (data ?? []).map(({ role }) => role as AppRole);
    const userRole = priority.find((candidate) => assignedRoles.includes(candidate)) || "user";

    applyRole(userRole, userId);
  };

  const syncAuthState = async (nextSession: Session | null) => {
    // If we already have a cached role for this user, skip the "loading" splash entirely.
    const cached = readCachedRole(nextSession?.user?.id);
    if (!cached) setLoading(true);
    try {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await checkRole(nextSession.user.id);
      } else {
        resetAuthState();
      }
    } catch (error) {
      console.warn("Auth sync failed", error);
      if (nextSession?.user) applyRole("user", nextSession.user.id);
      else resetAuthState();
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void syncAuthState(session), 0);
    });

    void (async () => {
      const { data: { session }, error } = await withTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: new Error("Session lookup timeout") } as Awaited<ReturnType<typeof supabase.auth.getSession>>
      );

      if ((error as any)?.code === "refresh_token_not_found") {
        await supabase.auth.signOut();
        resetAuthState();
        setLoading(false);
        return;
      }

      await syncAuthState(session);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) await syncAuthState(data.session);
    return { error: error as Error | null, session: data.session ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string, businessType?: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, business_type: businessType || "casa", phone: phone || "" },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isAgent, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

const FALLBACK_AUTH: AuthContextType = {
  user: null,
  session: null,
  isAdmin: false,
  isAgent: false,
  role: "user",
  loading: false,
  signIn: async () => ({ error: new Error("AuthProvider not mounted"), session: null }),
  signUp: async () => ({ error: new Error("AuthProvider not mounted") }),
  signOut: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (typeof window !== "undefined") {
      console.warn("useAuth called outside AuthProvider — returning safe fallback");
    }
    return FALLBACK_AUTH;
  }
  return ctx;
};
