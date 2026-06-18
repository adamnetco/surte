# POS-cf-env-vars

**Estado:** SHIPPED
**Módulo:** superadmin / cloudflare / edge-functions
**Owner:** Eduardo

## Problema
Existen literales hardcoded relacionados con la infraestructura Lovable/Cloudflare que dificultan multi-entorno y cambio de proveedor:
- `CF_EDGE_IP = "185.158.133.1"` en `src/modules/superadmin/components/SiteDetailsPanel.tsx:48`
- `ASTRO_HOST_IP = "185.158.133.1"` en `src/modules/superadmin/pages/Sitios.tsx:25`
- `sistecpos-storefront` y zonas/hostnames en varias edge functions de Cloudflare.

Si Lovable cambia su IP anycast, o si necesitamos un edge alterno (staging), hay que tocar código en múltiples lugares.

## Diseño
1. Crear módulo `src/modules/superadmin/lib/infraConfig.ts` que lea variables `VITE_LOVABLE_EDGE_IP`, `VITE_LOVABLE_STOREFRONT_SLUG` con defaults seguros.
2. Edge functions: leer `LOVABLE_EDGE_IP`, `LOVABLE_STOREFRONT_SLUG`, `CLOUDFLARE_FALLBACK_ZONE_ID`, `CLOUDFLARE_FALLBACK_HOSTNAME` desde `Deno.env` (las 2 últimas ya existen).
3. Documentar en `docs/api/edge-functions.md` qué vars deben configurarse por entorno.
4. Reemplazar usos hardcoded por el módulo central.

## Criterios de Aceptación
- [x] AC1: Cero ocurrencias de `185.158.133.1` fuera de `infraConfig.ts` y de docs.
- [x] AC2: Cero ocurrencias del literal `sistecpos-storefront` fuera del módulo central (sólo queda el fallback documentado en `provision-tenant-domain`).
- [x] AC3: Edge function `provision-tenant-domain` lee `LOVABLE_STOREFRONT_SLUG` / `LOVABLE_ROOT_DOMAIN` desde `Deno.env` con fallback documentado.
- [x] AC4: Override por env var funciona en Test sin redeploy del frontend (Vite HMR recoge `VITE_LOVABLE_*`).
- [x] AC5: Doc `docs/api/edge-functions.md` lista todas las vars y su default.

## Archivos a tocar
- `src/modules/superadmin/lib/infraConfig.ts` (nuevo)
- `src/modules/superadmin/components/SiteDetailsPanel.tsx`
- `src/modules/superadmin/pages/Sitios.tsx`
- `supabase/functions/cloudflare-domain-connect/index.ts`
- `supabase/functions/cloudflare-domain-reprovision/index.ts`
- `supabase/functions/tenant-create-with-owner/index.ts`
- `docs/api/edge-functions.md`

## Notas
Pendiente de definir: ¿queremos también permitir `dns_mode` por defecto configurable por org (no global)?
