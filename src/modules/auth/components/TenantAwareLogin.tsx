import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";

const Login = lazy(() => import("@/modules/auth/pages/Login"));
const LoginRouter = lazy(() => import("@/modules/auth/pages/LoginRouter"));

/**
 * Punto único de entrada de login. Decide qué pantalla mostrar según el host:
 *  - Storefront (subdominios de tenant) → Login (branded por tenant).
 *  - Sistema (admin/app/www/sistecpos.com, preview) → LoginRouter (portal SaaS).
 *
 * Las rutas `/login`, `/user/login` y `/admin/login` apuntan todas aquí para
 * evitar la dispersión actual donde cada ruta mostraba un componente distinto.
 */
const TenantAwareLogin = () => {
  const tenant = detectTenant();
  const isStorefront = isStorefrontTenant(tenant);
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted-foreground text-sm">
          <Loader2 className="animate-spin mr-2" size={16} /> Cargando…
        </div>
      }
    >
      {isStorefront ? <Login /> : <LoginRouter />}
    </Suspense>
  );
};

export default TenantAwareLogin;
