import { ReactNode } from "react";
import { detectTenant, isStorefrontTenant, isSystemTenant, isPreviewHost } from "@/modules/tenant/lib/subdomain";
import { ShieldAlert, ExternalLink } from "lucide-react";

type Scope = "system" | "storefront";

interface Props {
  /**
   * "system"     → la ruta solo tiene sentido en hosts del panel SaaS
   *                 (admin.sistecpos.com, app.sistecpos.com, sistecpos.com).
   * "storefront" → la ruta solo tiene sentido en un host de tenant
   *                 (<slug>.sistecpos.com).
   */
  require: Scope;
  children: ReactNode;
  /** Si está en producción y el host no aplica, a dónde redirige. */
  fallbackUrl?: string;
}

/**
 * Bloquea rutas que no corresponden al host actual.
 * - En preview / dev (lovable.app, localhost) NO redirige: permite testear todo.
 * - En producción muestra una pantalla clara con CTA al host correcto.
 */
export default function HostGuard({ require, children, fallbackUrl }: Props) {
  // En preview/dev no aplicamos host guard — el desarrollador debe poder
  // navegar a cualquier ruta usando ?tenant=... cuando lo necesite.
  if (isPreviewHost()) return <>{children}</>;

  const tenant = detectTenant();
  const ok =
    require === "system" ? isSystemTenant(tenant) : isStorefrontTenant(tenant);

  if (ok) return <>{children}</>;

  const target =
    fallbackUrl ??
    (require === "system"
      ? "https://admin.sistecpos.com/"
      : "https://sistecpos.com/");

  const title =
    require === "system"
      ? "Esta sección vive en el panel SistecPOS"
      : "Esta sección vive en la tienda del negocio";

  const body =
    require === "system"
      ? "Estás en el host de un negocio. Abre el panel de administración SistecPOS para continuar."
      : "Estás en un host del panel SaaS. Las páginas de catálogo / carrito viven en el subdominio de cada tienda.";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center border border-border rounded-xl bg-card p-6">
        <div className="w-12 h-12 mx-auto rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
          <ShieldAlert size={20} />
        </div>
        <h1 className="font-heading font-bold text-lg mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-5">{body}</p>
        <a
          href={target}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Ir al sitio correcto <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
