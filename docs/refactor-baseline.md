# Refactor Baseline — SistecPOS

Línea base capturada al iniciar la Etapa 0 del plan en `.lovable/plan.md`.
Sirve como referencia para validar que ninguna etapa posterior empeore
métricas (cobertura, bundle, queries, etc.).

> Actualizar este documento al cerrar cada etapa con los nuevos números.

## Volumen de código

| Métrica                          | Valor    |
| -------------------------------- | -------- |
| Archivos `.ts` / `.tsx` en `src` | 273      |
| Edge functions (`supabase/functions`) | 41  |
| LOC total `src/pages/*` + `App.tsx`   | ~8.900 |

### Subcarpetas actuales en `src/components`
`admin`, `clientes`, `onboarding`, `pos`, `seo`, `shared`, `superadmin`,
`surte`, `ui` + componentes sueltos en raíz (AppErrorBoundary,
CartNavigationGuard, etc.).

> En Etapa 1 estos se mueven a `src/modules/<dominio>/`.

## Hallazgos `ts-prune` (exports muertos o sólo internos)

Top candidatos a borrar o convertir en internos:

- `src/lib/whatsapp.ts` → `openWhatsApp`, `whatsappUrl` exportados pero
  no usados fuera del módulo.
- `src/lib/whatsappFlowTemplate.ts` → `WHATSAPP_FLOW_TEMPLATE`,
  `PersistentCartLine`, `buildCartHandoffLink`.
- `src/lib/subdomain.ts` → `clearTenantOverride`, `isTenant`.
- `src/lib/ssoHandoff.ts` → `tenantHost`.
- `src/lib/posBusinessPresets.ts` → `getPresetByKey`.
- `src/lib/errors.ts` → `safeAsync`.
- `src/utils/emailTemplates.ts` → `passwordRecoveryTemplate`.
- `src/lib/schemas.ts` → tipo `ProductFormValues` re-export.
- `src/components/surte/GoogleReviewsSection.tsx` default export sin
  consumidor.
- `src/components/clientes/ClientPOSLogin.tsx` doble export (`default` +
  named) — uno sobra.

Acción Etapa 1: confirmar 0 consumidores con `rg` antes de borrar.

## Componentes con duplicación visible

- `FloatingCart` + `CartDrawer` + `FloatingWhatsApp` → comparten patrón
  de botón flotante + sheet; unificar wrapper en Etapa 5.
- `GoogleReviewsDisplay` + `GoogleReviewsSection` → revisar si ambos
  deben existir.

## Backend

- 41 edge functions; sólo unas pocas con tests (`tenantDataIsland`,
  `tenantScope`). El resto entra al backlog de Etapa 7.
- Tablas con RLS y políticas: ver `docs/api/tables.md` (auditoría
  pendiente en Etapa 7 con `supabase--linter`).
- Sin índice declarado en este repo para columnas calientes
  (`orders.tenant_id`, `orders.created_at`, `products.brand_id`,
  `pos_sessions.status`) — verificar en Etapa 7 con `EXPLAIN ANALYZE`.

## Tests

- e2e Playwright: `e2e/pos.spec.ts`, `e2e/superadmin.spec.ts` ya
  cubiertos por CI con annotations, flakey isolation y umbral nocturno.
- Vitest: `src/test/example.test.ts`, `src/test/dataImportUtils.test.ts`,
  `src/lib/tenantDataIsland.test.ts`, `src/lib/tenantScope.test.ts`,
  `src/components/pos/SaleCompleteDialog.test.tsx`,
  `src/components/superadmin/RequireActiveTenant.test.tsx`,
  `src/components/superadmin/TenantSwitcher.test.tsx`.
- **Cobertura vitest**: ejecutar `npx vitest run --coverage` y pegar el
  resumen por carpeta aquí al cierre del primer PR de Etapa 0.

### Gaps de tests e2e a cubrir antes de Etapa 1

- Storefront → checkout WhatsApp (guest).
- Onboarding → wizard completo (NIT lookup, subdomain, owner create).
- Cliente Portal → login + ver suscripción.

## Performance (a llenar)

Ejecutar y pegar resultados:

```bash
npm run build -- --report   # tamaño chunk inicial y por ruta
npx lhci autorun            # Lighthouse de POS, Storefront, SuperAdmin
```

Objetivos para Etapa 6:

| Vista        | LCP   | INP   | Bundle JS inicial |
| ------------ | ----- | ----- | ------------------ |
| Storefront   | < 2.0s | < 200ms | < 250 kB gz       |
| POS          | < 1.5s | < 100ms | < 300 kB gz       |
| SuperAdmin   | < 2.5s | < 200ms | < 350 kB gz       |

## Feature flags

Habilitadas en Etapa 0 vía tabla `feature_flags` + hook
`useFeatureFlag(key)`. Cada refactor de etapas posteriores se envuelve
con un flag para poder apagarlo en producción sin revert.

Convención de claves:

- `refactor.modules-layout` — Etapa 1
- `refactor.tanstack-query` — Etapa 2
- `refactor.zustand-stores` — Etapa 3
- `refactor.zod-everywhere` — Etapa 4
- `refactor.design-tokens-lint` — Etapa 5
- `refactor.bundle-splitting` — Etapa 6

## Próximo paso

Cerrar Etapa 0 con:

1. Migración `feature_flags` aplicada.
2. Hook `useFeatureFlag` en uso (mínimo 1 consumidor de prueba).
3. e2e ampliado a Storefront + Onboarding.
4. `npm run build -- --report` y `vitest --coverage` pegados arriba.

Una vez verde, avanzar a Etapa 1 (mover carpetas a `src/modules/`).
