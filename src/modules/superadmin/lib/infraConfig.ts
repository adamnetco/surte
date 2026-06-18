/**
 * Centraliza literales de infraestructura Lovable/Cloudflare que antes vivían
 * hardcodeados en componentes y edge functions.
 *
 * Override por entorno con variables Vite (rebuild / vite reload):
 *   VITE_LOVABLE_EDGE_IP        — IP anycast del edge de Lovable (default 185.158.133.1)
 *   VITE_LOVABLE_STOREFRONT_SLUG — slug del proyecto Cloudflare Pages del storefront
 *   VITE_LOVABLE_ROOT_DOMAIN     — dominio raíz del SaaS (default sistecpos.com)
 *
 * En edge functions usar los nombres equivalentes sin prefijo VITE_ vía Deno.env.
 */

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env ?? {};

export const LOVABLE_EDGE_IP: string =
  env.VITE_LOVABLE_EDGE_IP?.trim() || "185.158.133.1";

export const LOVABLE_STOREFRONT_SLUG: string =
  env.VITE_LOVABLE_STOREFRONT_SLUG?.trim() || "sistecpos-storefront";

export const LOVABLE_ROOT_DOMAIN: string =
  env.VITE_LOVABLE_ROOT_DOMAIN?.trim() || "sistecpos.com";

export const LOVABLE_STOREFRONT_CNAME: string = `${LOVABLE_STOREFRONT_SLUG}.pages.dev`;
