# Módulo: superadmin

Gestión multi-tenant a nivel de plataforma (solo rol `superadmin`).

## Estructura

```
src/modules/superadmin/
├── components/   # Sidebar, Breadcrumb, TenantSwitcher, TenantHealth, etc.
├── pages/        # SuperadminDashboard, Sitios, Licencias, TenantWorkspace, CatalogosBase
└── index.ts      # Barrel público
```

## Reglas

- No importar directamente desde `@/modules/superadmin/components/...` fuera del módulo. Usar el barrel `@/modules/superadmin`.
- No depender de otros módulos (`pos`, `storefront`, `admin-cms`); navegar por rutas (`/admin`, `/pos`).
- Acceso restringido por `HostGuard require="system"` + verificación de rol vía `has_role`.

## Consumers

- `src/App.tsx` (rutas `/superadmin/*`, `/sitios`, `/licencias`, `/catalogos-base`, `/t/:slug/admin`).

## Próximo módulo

`clientes` (Portal cliente: `src/components/clientes/*` + páginas asociadas).
