# Plan: Hardening UX/Performance del POS + Aprovisionamiento de subdominio por tienda

## Respuesta a tu pregunta (subdominio automático)

**Sí, lo validé y lo incluyo en el plan.** Hoy ya existe la infraestructura para multi-tenant por subdominio:

- `src/modules/tenant/lib/subdomain.ts` detecta `<slug>.sistecpos.com` como storefront del negocio (ej. `surteya.sistecpos.com`).
- Tabla `tenant_sites` (sitios por organización) + `tenant_domains` (dominios custom) + edge functions `cloudflare-domain-connect` / `cloudflare-domain-status` (Cloudflare for SaaS Custom Hostnames con `CLOUDFLARE_FALLBACK_ZONE_ID`).
- Astro starter (`astro-starter/`) ya lee el tenant por host.

Lo que **falta** y se añade al plan: al crear una `organization` (o aceptar un `org_signup_request`), generar automáticamente:

1. Un `tenant_sites` con `subdomain = <slug>` (slug derivado del nombre, validado único contra reservas: admin/mi/pos/app/www/api/staging/preview).
2. Un `tenant_domains` con `hostname = <slug>.sistecpos.com`, `dns_mode = 'saas'`, marcado como `is_primary = true`.
3. Registro del Custom Hostname en Cloudflare (reutilizando `cloudflare-domain-connect` para que SSL/HTTP-01 se emita solo).
4. Publicar el sitio Astro en modo "auto" (placeholder) para que el subdominio responda en cuanto el SSL esté activo.

---

## Fase 1 — Endpoint unificado de salud (Core + Sitios)

**Edge function nueva:** `supabase/functions/health-snapshot/index.ts`

- Input: `{ organization_id }` (token requerido).
- Salida única y consistente:
  ```json
  {
    "core": { "status": "ok|warn|off", "latency_ms": 123, "checked_at": "..." },
    "sites": { "total": 3, "published": 2, "last_sync_at": "...", "items": [{id,slug,is_published,hostname,cf_status,cf_ssl_status,last_sync_at}] },
    "wp": { "connected": true, "errors": [] },
    "version": "v1"
  }
  ```
- Cache server-side de 10s por org (Map en memoria) → menos hits a Postgres.
- Reutilizar `cloudflare-domain-status` internamente para refrescar SSL si `last_checked_at > 5 min`.

## Fase 2 — Hook resiliente `useHealthSnapshot`

`src/modules/pos/hooks/useHealthSnapshot.ts`:

- React Query `staleTime: 15s`, `refetchInterval: 20s`, `refetchOnWindowFocus: true`.
- **Backoff exponencial** en errores (20s → 40s → 80s → máx 5min), con `retry: (n) => n < 5`.
- `keepPreviousData: true` para no perder UI si falla un poll.
- `select()` memoizado para que sólo se re-renderice la pill cuyo status cambió.
- Logger via `@/lib/logger` con `correlation_id`.

## Fase 3 — Barra de estado: estados degradados + acciones

Refactor `POSStatusBar.tsx` y nuevo `StatusPill.tsx`:

- 4 estados: `ok | warn | off | unknown` con icono + color + texto accesible (`aria-live="polite"`, `role="status"`).
- Cada pill abre **Popover** con:
  - Mensaje claro del error (ej. "Agente local no responde en puerto 9100").
  - Botón **"Reintentar"** (dispara `refetch()` inmediato y resetea backoff).
  - Botón **"Resolver"** → link a la página adecuada (`/sitios`, `/configuracion/impresoras`, doc URL).
  - Últimos 3 eventos del logger filtrados por `source`.
- Impresora: si `pingAgent()` falla 3× consecutivas → estado `off` + toast una vez (no spam).
- WordPress (nuevo en la barra): consume `health.wp.connected`, link a `/sitios` con tab WP.

## Fase 4 — Accesibilidad POS + PosHub

- `POSStatusBar`: `role="status"`, `aria-label="Estado del sistema"`, cada pill `<button>` con `aria-describedby`, navegable con Tab, foco visible (`focus-visible:ring-2 ring-ring`).
- Contraste verificado AA: cambiar `bg-emerald-500`/`bg-rose-500` por tokens (`bg-success`, `bg-destructive`) ya definidos en index.css.
- PosHub: `<main>` único, headings jerárquicos (h1 página, h2 secciones, h3 tiles), tiles como `<a>` reales (no div onClick), atajos de teclado (`g s` → Sitios, `g p` → POS) vía `usePOSHotkeys`.
- Grid Sitios: cada card `<article aria-labelledby>`, badges con texto + icono (no sólo color), botones icon-only con `aria-label`.

## Fase 5 — Panel de detalles por Sitio

Expandir `src/modules/superadmin/pages/Sitios.tsx`:

- Card compacta en mobile (≤ sm): nombre, badge de estado, botón "Ver detalles" → Sheet lateral.
- Desktop: `Collapsible` dentro de la card revelando:
  - Última sincronización (relativa: "hace 2 min") + timestamp absoluto en `title`.
  - Estado de publicación (publicado/borrador) + último deploy.
  - Estado Cloudflare (`cf_status`, `cf_ssl_status`) + botón "Verificar DNS".
  - Conteo de productos sincronizados.
  - Acciones: Sincronizar, Publicar/Despublicar, Abrir WP Admin, Ver sitio, Configurar dominio.
- Skeletons (`SkeletonPresets`) para cada bloque.

## Fase 6 — Auto-aprovisionamiento de subdominio (respuesta a tu pregunta)

**Edge function nueva:** `provision-tenant-subdomain`

- Trigger: invocada desde `OrganizationsTab` al crear org **y** desde `approve-org-signup`.
- Lógica:
  1. Slugify nombre → validar contra reservas (`admin|mi|pos|app|www|api|staging|preview|sistecpos`) y unicidad en `tenant_sites.subdomain`.
  2. Insertar `tenant_sites { organization_id, subdomain, is_published: false }`.
  3. Insertar `tenant_domains { site_id, hostname: '<slug>.sistecpos.com', dns_mode: 'saas', is_primary: true }`.
  4. Invocar `cloudflare-domain-connect` con `hostname` → registra Custom Hostname y deja SSL en `pending_validation`.
  5. Devolver `{ subdomain, hostname, ssl_status }` al admin que creó la org.
- UI: en `OrganizationsTab` mostrar el subdominio asignado en la fila + badge "SSL: emitiendo…" que se refresca cada 30s vía `cloudflare-domain-status` hasta `active`.
- Migración: `tenant_sites.subdomain` `UNIQUE NOT NULL` si aún no lo es; índice case-insensitive.

## Fase 7 — Verificación

- Tests Deno para `health-snapshot` (mock org con 0/1/N sitios).
- Test unitario para slugify + reservas.
- Lighthouse a `/pos` y `/sitios` (objetivo a11y ≥ 95).
- Verificar backoff con DevTools (cortar red → ver intervalos crecientes en logs).
- Verificar accesibilidad con teclado: Tab recorre toda la barra y todas las cards.

## Archivos a crear / editar

**Crear:**

- `supabase/functions/health-snapshot/index.ts`
- `supabase/functions/provision-tenant-subdomain/index.ts`
- `src/modules/pos/hooks/useHealthSnapshot.ts`
- `src/modules/pos/components/StatusPill.tsx`
- `src/modules/superadmin/components/SiteDetailsPanel.tsx`
- `src/modules/superadmin/lib/slugify.ts` (+ test)

**Editar:**

- `src/modules/pos/components/POSStatusBar.tsx` (consume hook, pills accesibles)
- `src/modules/pos/pages/PosHub.tsx` (a11y, headings, tiles `<a>`)
- `src/modules/superadmin/pages/Sitios.tsx` (panel de detalles, cards a11y)
- `src/modules/admin-cms/components/OrganizationsTab.tsx` (mostrar subdominio + invocar provision)
- Migración SQL: `tenant_sites.subdomain UNIQUE`, índice ci.

¿Apruebas el plan? Si quieres, ajusto el orden (por ejemplo, ejecutar primero Fase 6 del subdominio, o priorizar la Fase 1+2+3 de la barra). ejecuta plan como sea mas eficiente y optimo.