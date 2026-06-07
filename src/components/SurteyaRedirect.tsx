import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";

/**
 * Redirige rutas legacy de Surteya (`/catalogo`, `/producto/:id`, ...) al prefijo
 * `/surteya/...` cuando el visitante NO está en el subdominio del tenant
 * (p.ej. está en `sistecpos.com` o `www.sistecpos.com`).
 *
 * En el subdominio `surteya.sistecpos.com` no hace nada → renderiza children.
 *
 * SEO: añade tag canonical apuntando al nuevo subdominio para que Google
 * consolide señales aunque el redirect sea client-side (no podemos emitir
 * 301 reales desde una SPA en Lovable hosting).
 */
const LEGACY_TENANT_SLUG = "surteya";
const CANONICAL_HOST = "https://surteya.sistecpos.com";

interface Props {
  children: React.ReactNode;
  /** Path bajo `/surteya/` al que se redirige. Ej: "/catalogo" → /surteya/catalogo */
  legacyPrefix?: string;
}

export default function SurteyaRedirect({ children, legacyPrefix }: Props) {
  const location = useLocation();
  const tenant = detectTenant();

  // Si estoy en el subdominio del tenant (o cualquier otro storefront), no redirijo.
  if (isStorefrontTenant(tenant)) {
    // SEO: canonical al subdominio nativo
    useEffect(() => {
      const linkId = "canonical-tenant";
      let link = document.querySelector<HTMLLinkElement>(`link#${linkId}`);
      if (!link) {
        link = document.createElement("link");
        link.id = linkId;
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = `https://${tenant}.sistecpos.com${location.pathname}${location.search}`;
      return () => {
        link?.remove();
      };
    }, [tenant, location.pathname, location.search]);
    return <>{children}</>;
  }

  // En sistecpos.com / app / www: redirigir a /surteya/* (client-side 301 equivalente).
  const target =
    `/${LEGACY_TENANT_SLUG}${legacyPrefix ?? location.pathname}` +
    location.search +
    location.hash;
  return <Navigate to={target} replace />;
}

/** Componente que sólo emite el tag canonical (sin redirigir). */
export function CanonicalTenantTag() {
  const tenant = detectTenant();
  const location = useLocation();
  useEffect(() => {
    if (!isStorefrontTenant(tenant)) return;
    const link = document.createElement("link");
    link.rel = "canonical";
    link.href = `${CANONICAL_HOST}${location.pathname}${location.search}`;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [tenant, location.pathname, location.search]);
  return null;
}
