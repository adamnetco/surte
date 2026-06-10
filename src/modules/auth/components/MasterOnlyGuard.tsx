import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/context/AuthContext";

const MASTER_EMAIL = "eduardotp77@gmail.com";

/**
 * Restringe el acceso únicamente al superadmin maestro
 * (eduardotp77@gmail.com). Cualquier otro usuario, autenticado o no,
 * es redirigido al home. Pensado para vistas de auditoría visual como
 * /admin/diag.
 */
export default function MasterOnlyGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">
        Verificando acceso…
      </div>
    );
  }

  const email = user?.email?.toLowerCase() ?? "";
  if (!user || email !== MASTER_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
