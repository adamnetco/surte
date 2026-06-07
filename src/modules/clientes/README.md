# Módulo: clientes

Portal de clientes SaaS (suscripción, billing, tickets, descargas, onboarding).

## Estructura
- `components/` — UI interna del portal cliente (Shell, tabs, POS access, ticket chat).
- `pages/` — `Billing`, `Planes`, `Onboarding`.
- `index.ts` — Barrel público.

## Reglas
- Importar SOLO vía `@/modules/clientes` desde fuera del módulo.
- No depender de otros módulos (`pos`, `storefront`, `admin-cms`, `superadmin`).
- Componentes internos del módulo pueden importarse entre sí por ruta relativa.

## Consumidores actuales
- `src/App.tsx` (rutas `/mi/*`, `/planes`, `/billing`, `/onboarding`).
