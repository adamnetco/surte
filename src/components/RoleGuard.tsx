import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppRole } from "@/context/AuthContext";
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

/**
 * Guard de rutas: bloquea acceso si el rol del usuario no está en `allowed_roles`
 * de la sección configurada en la tabla `admin_section_access`.
 * El usuario maestro (eduardotp77@gmail.com / superadmin) siempre tiene acceso.
 */
const RoleGuard = ({
  section,
  children,
  fallbackRoles = ["superadmin", "admin"],
  redirectTo = "/login",
}: RoleGuardProps) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<AppRole[] | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("admin_section_access")
        .select("allowed_roles")
        .eq("section_key", section)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) setAllowed(fallbackRoles);
      else setAllowed((data.allowed_roles as AppRole[]) ?? fallbackRoles);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  if (loading || checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">
        Verificando permisos…
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  // Superadmin maestro siempre pasa
  const isMaster = role === "superadmin";
  const list = allowed ?? fallbackRoles;
  if (!isMaster && !list.includes(role)) {
    return (
      <Navigate
        to="/admin/diag"
        replace
        state={{
          denied: true,
          section,
          role,
          allowed: list,
        }}
      />
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
