# Refactor y Optimización SistecPOS — Plan por Etapas

Objetivo: dejar el sistema más rápido, mantenible y testeable, sin tocar funcionalidades en producción. Cada etapa es entregable de forma independiente y reversible. Se prioriza primero red de seguridad (tests + observabilidad), luego deuda estructural, luego performance, luego pulido.

---

## Etapa 0 — Línea base y guardarraíles (1 sprint)

Antes de refactorizar, medir y blindar.

- **Inventario técnico**: árbol de rutas, tabla de componentes huérfanos (`ts-prune`), dependencias sin usar (`depcheck`), bundle inicial (`vite build --report`), Lighthouse de POS, Storefront y SuperAdmin.
- **Cobertura actual**: ejecutar `vitest --coverage` y publicar % por carpeta (`src/components/pos`, `src/components/surte`, `src/pages`, `supabase/functions`).
- **Health del backend**: `supabase--linter`, lista de tablas sin RLS, edge functions sin tests, índices faltantes en queries calientes.
- **Tests críticos**: ampliar el e2e ya existente (POS, SuperAdmin) con flujos de Storefront (checkout WhatsApp), Onboarding y Cliente Portal. Estos son el contrato que protege el refactor.
- **Feature flags simples**: tabla `feature_flags` + hook `useFeatureFlag` para activar/desactivar refactors por tenant.

Entrega: dashboard markdown `docs/refactor-baseline.md` con métricas. Sin esto, no se empieza la Etapa 1.

---

## Etapa 1 — Arquitectura de carpetas y límites de módulo (1–2 sprints)

Mover de "todo en `src/components/*` y `src/pages/*`" a módulos por dominio.

```text
src/
  modules/
    pos/         (workspace, cierre, hotkeys, offline)
    storefront/  (catálogo, carrito, checkout)
    admin-cms/   (productos, categorías, marcas, landings)
    superadmin/  (tenants, health, billing)
    clientes/    (portal, tickets, suscripción)
    auth/        (login, SSO, guardas)
  shared/        (ui, hooks, lib, schemas)
  integrations/  (supabase, lovable, whatsapp, push)
```

- Cada módulo expone un `index.ts` público; el resto es interno.
- ESLint con `eslint-plugin-boundaries` para impedir imports cruzados entre módulos.
- Rutas movidas desde `App.tsx` a `modules/*/routes.tsx` (lazy-loaded).
- `src/pages/*` queda solo como shell que delega en módulos.

No se reescribe lógica: solo se mueven archivos y se ajustan imports. Cada PR cubre 1 módulo y se valida con el e2e de Etapa 0.

---

## Etapa 2 — Capa de datos unificada (2 sprints)

Hoy hay mezcla de `supabase.from(...).select(...)` directo en componentes, hooks ad-hoc y `useEffect` con fetch manual. Causa: queries duplicadas, sin caché, sin reintentos.

- Adoptar **TanStack Query** como capa única de fetching.
- Crear `src/modules/<m>/api/` con funciones puras (`listProducts(filters)`, `createOrder(payload)`) que devuelven `Promise<T>`.
- Hooks tipo `useProductsQuery`, `useCreateOrderMutation` envuelven esas funciones con keys consistentes (`['products', tenantId, filters]`).
- Suscripciones Realtime se conectan a la caché de Query (`queryClient.setQueryData`), no a estado local.
- Borrar `useEffect + setState` de fetching, eliminar duplicación entre Storefront y Admin (mismo producto, dos queries distintas hoy).

Beneficio medible: caída de requests duplicados, navegación instantánea entre vistas, menos bugs de "datos viejos tras editar".

---

## Etapa 3 — Estado global y contextos (1 sprint)

Auditar y reducir Contexts. Hoy: `Auth`, `Cart`, `Organization`, `Agent`, `Swipe`, `Theme`.

- Mantener Context solo para identidad y tema (cambian poco, se leen en todas partes).
- Migrar `Cart`, `Agent`, `Swipe` a **Zustand** con stores tipados y selectores. Evita re-renders globales.
- `OrganizationContext` se reemplaza por un `useTenant()` que lee de `useTenantFromRoute` + Query (ya viene cacheado por TanStack).
- Persistencia de carrito y sesión POS pasan al middleware `persist` de Zustand (reemplaza el localStorage manual del Persistent Cart).

---

## Etapa 4 — Tipos y validación de extremo a extremo (1 sprint)

- Regenerar `src/integrations/supabase/types.ts` (automático) y eliminar todos los `any` / `as unknown as`.
- **Zod** como contrato único: schemas en `src/shared/schemas/` consumidos por React Hook Form, edge functions (Deno), y respuestas de API.
- Edge functions Deno: cada una valida `input` con Zod y devuelve `{ ok, data | error }` tipado. Cliente consume con `z.infer`.
- Activar `"strict": true` y `noUncheckedIndexedAccess` en `tsconfig.app.json`. Arreglar errores por módulo, no en bloque.

---

## Etapa 5 — UI: design system y consistencia (1–2 sprints)

- Auditar usos de color literal (`text-white`, `bg-[#0C4B83]`) y reemplazar por tokens semánticos en `index.css` (`--primary`, `--success`, `--alert`). Lint con regex en CI.
- Consolidar variantes de botón, badge, dialog en `cva` (ya parcialmente hecho). Borrar duplicados (`FloatingCart`, `FloatingWhatsApp`, `CartDrawer` comparten estilos).
- Toasts top-center y badges top-de-imagen como wrappers (`<SistecToast>`, `<StatusBadge>`) — para no repetir clases.
- `window.confirm` admin → componente `<ConfirmDialog>` reutilizable manteniendo el patrón obligatorio para acciones destructivas.
- Storybook ligero (`@storybook/react-vite`) solo para `shared/ui` y componentes POS/Storefront críticos. Sirve también como QA visual.

---

## Etapa 6 — Performance frontend (1 sprint)

- **Bundle splitting**: cada módulo lazy con `React.lazy`. Hoy todo entra en el chunk inicial.
- **Route prefetch** en hover/visible (TanStack Router-style) en `BottomNav` y `POSTopBar`.
- **Imágenes**: forzar `optimize-image` EF en todo `<img>` del Storefront; `loading="lazy"` + `decoding="async"` + `width/height` explícito para evitar CLS.
- **VirtualizedProductGrid** ya existe — extender a Admin (`ProductsTable`, `OrdersList`) cuando hay >100 filas.
- **Memoización selectiva**: `React.memo` + `useMemo` solo donde el profiler muestra re-renders >16ms. No memoizar de más.
- **SW push** y `useSyncService` revisados para no despertar el hilo principal en idle.

Métrica objetivo: LCP Storefront < 2.0s en 4G simulado, INP POS < 100ms.

---

## Etapa 7 — Backend: Supabase y edge functions (2 sprints)

- **RLS audit**: revisar cada tabla con `supabase--linter`; documentar política por tabla en `docs/rls-matrix.md`. Cerrar permisos `anon` salvo catálogos públicos.
- **Roles**: confirmar que ninguna verificación de admin se hace en cliente — todo vía `has_role(auth.uid(), 'admin')`.
- **Índices**: añadir índices en columnas de filtros pesados (`orders.tenant_id`, `orders.created_at`, `products.brand_id`, `pos_sessions.status`). Validar con `EXPLAIN ANALYZE` antes/después.
- **Edge functions**:
  - Carpeta `_shared/` con helpers comunes (auth, cors, response, logger).
  - Reintentos exponenciales en integraciones (YCloud, Resend, Innapsis).
  - Tests con `deno test` para las funciones críticas (`send-whatsapp-order`, `sync-order`, `cart-sync`, `license-*`).
- **Outbox offline POS**: revisar idempotencia (clave única por `client_op_id`) para evitar duplicados al reintentar.

---

## Etapa 8 — Multi-tenant y SuperAdmin (1 sprint)

- Garantizar `tenant_id` en toda query (helper `withTenant(query, tenantId)` obligatorio en `modules/*/api`).
- Test unitario por módulo: "no leak entre tenants" (consulta como tenant A no devuelve filas de tenant B).
- `TenantSwitcher` y `RequireActiveTenant` movidos a `modules/superadmin`, ya con tests.
- Sync Test → Live como job idempotente con dry-run y diff visible antes de aplicar.

---

## Etapa 9 — Observabilidad y calidad continua (1 sprint)

- **Error tracking**: Sentry (o equivalente) con releases atadas a commit. Filtrar por módulo.
- **Logs estructurados** en edge functions (JSON con `tenant_id`, `function`, `latency_ms`).
- **Métricas de negocio**: panel en SuperAdmin con ventas/hora, errores de sync, sesiones POS abiertas, tasa de carritos abandonados.
- **CI**: el pipeline e2e ya bloquea merge con PR annotations y aísla `@flaky` (hecho). Añadir job de Lighthouse-CI con presupuesto de bundle y LCP.

---

## Etapa 10 — Documentación y handoff (continuo)

- `docs/architecture.md` con diagrama por módulos.
- `docs/api/*` ya existe — mantener al día tras Etapa 4 (schemas Zod son la fuente).
- README por módulo (`src/modules/<m>/README.md`): propósito, entry points, dependencias, decisiones.
- ADRs cortos (`docs/adr/NNN-titulo.md`) para cada decisión grande tomada en este refactor.

---

## Detalles técnicos clave

- **Orden no negociable**: 0 → 1 → 2 → 3 → 4. Las demás (5–10) pueden paralelizarse entre 2 equipos una vez la capa de datos (2) está estable.
- **Estrategia de PRs**: cada etapa se divide en PRs ≤ 400 líneas; cada PR debe pasar el e2e completo y mantener cobertura ≥ baseline.
- **Rollback**: feature flags + ramas por módulo permiten desactivar un refactor en producción sin revertir commits.
- **Riesgos**:
  - Etapa 2 (TanStack) toca todas las pantallas — mitigar migrando módulo por módulo, no global.
  - Etapa 4 (`strict: true`) puede destapar bugs latentes — agendarla con margen.
  - Etapa 7 (índices/RLS) requiere ventana de mantenimiento si la BD es grande.

## Estimación total

~12–14 sprints (3–4 meses) con 1 dev full-time, o ~6–8 sprints con 2 devs paralelizando desde Etapa 5.
