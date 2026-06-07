import { useCallback } from "react";
import { buildHandoffUrl } from "@/modules/auth/lib/ssoHandoff";
import type { Tenant } from "@/modules/tenant/lib/subdomain";

interface Props extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  tenant: Tenant;
  path?: string;
  children: React.ReactNode;
}

/**
 * Link que salta a otro subdominio de sistecpos.com llevando la sesión
 * actual mediante SSO handoff (fragment URL). En dev usa ?tenant=.
 *
 * Uso:
 *   <TenantLink tenant="pos" path="/">Abrir POS</TenantLink>
 */
export default function TenantLink({ tenant, path = "/", children, onClick, ...rest }: Props) {
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      onClick?.(e);
      const url = await buildHandoffUrl(tenant, path);
      window.location.href = url;
    },
    [tenant, path, onClick]
  );

  return (
    <a href={`/?tenant=${tenant}`} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
