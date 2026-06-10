import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/modules/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface RoleGuardProps {
  section: string;
  children: ReactNode;
  /** Fallback roles si la tabla aún no respondió (por defecto superadmin+admin). */
  fallbackRoles?: AppRole[];
  /** Ruta a la que redirigir si NO hay sesión. */
  redirectTo?: string;
  /** Ruta a la que redirigir si hay sesión pero el rol no está autorizado. */
  deniedRedirect?: string;
}

const ALLOWED_CACHE_PREFIX = "sps_section_allowed:";

const readCachedAllowed = (section: string): AppRole[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ALLOWED_CACHE_PREFIX + section);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppRole[]) : null;
  } catch {
    return null;
  }
};

/**
 * Guard de rutas: bloquea acceso si el rol del usuario no está en `allowed_roles`
 * de la sección configurada en la tabla `admin_section_access`.
 * El usuario maestro (superadmin) siempre tiene acceso.
 *
 * Optimización: usa caches en localStorage para `role` (AuthContext) y
 * `allowed_roles` (esta guard) para resolver el acceso de forma síncrona en
 * la primera renderización y evitar el "spinner de permisos".
 */
const RoleGuard = ({
  section,
  children,
  fallbackRoles = ["superadmin", "admin"],
  redirectTo = "/login",
  deniedRedirect = "/",
}: RoleGuardProps) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<AppRole[] | null>(() => readCachedAllowed(section));
  const [checking, setChecking] = useState(() => readCachedAllowed(section) === null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("admin_section_access")
        .select("allowed_roles")
        .eq("section_key", section)
        .maybeSingle();
      if (cancelled) return;
      const next = (!error && data?.allowed_roles) ? (data.allowed_roles as AppRole[]) : fallbackRoles;
      setAllowed(next);
      setChecking(false);
      try { window.localStorage.setItem(ALLOWED_CACHE_PREFIX + section, JSON.stringify(next)); } catch { /* quota */ }
    })();
    return () => { cancelled = true; };
  }, [section]);

  // Si hay user + role + allowed cacheados ⇒ resolvemos sin esperar nada.
  const hasSyncDecision = user !== null && !loading && allowed !== null;

  if (!hasSyncDecision && (loading || (checking && !user))) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">
        Verificando permisos…
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  const isMaster = role === "superadmin";
  const list = allowed ?? fallbackRoles;
  if (!isMaster && !list.includes(role)) {
    return (
      <Navigate
        to={deniedRedirect}
        replace
        state={{ denied: true, section, role, allowed: list }}
      />
    );
  }

  return <>{children}</>;
};

export default RoleGuard;

