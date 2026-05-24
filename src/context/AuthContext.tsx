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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  const applyRole = (nextRole: AppRole) => {
    setRole(nextRole);
    setIsAdmin(["superadmin", "admin"].includes(nextRole));
    setIsAgent(nextRole === "agente");
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
    const { data: effectiveRole, error: rpcError } = await withTimeout(
      (supabase as any).rpc("get_current_user_role"),
      { data: null, error: new Error("Role lookup timeout") }
    );

    if (!rpcError && effectiveRole) {
      applyRole(normalizeRole(effectiveRole));
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      applyRole("user");
      return;
    }

    const priority: AppRole[] = ["superadmin", "admin", "editor", "agente", "user"];
    const assignedRoles = (data ?? []).map(({ role }) => role as AppRole);
    const userRole = priority.find((candidate) => assignedRoles.includes(candidate)) || "user";

    applyRole(userRole);
  };

  const syncAuthState = async (nextSession: Session | null) => {
    setLoading(true);
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
      if (nextSession?.user) applyRole("user");
      else resetAuthState();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void syncAuthState(session), 0);
    });

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if ((error as any)?.code === "refresh_token_not_found") {
        await supabase.auth.signOut();
        resetAuthState();
        setLoading(false);
        return;
      }

      await syncAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
