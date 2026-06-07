# Module: admin-cms

Tienda-level admin CMS: gestión de catálogo, contenido, marketing, configuración
fiscal y operativa para una organización (tenant).

## Estructura

```
src/modules/admin-cms/
├── components/   # 40 tabs/widgets (ProductsTab, CategoriesTab, OrdersTab, ...)
├── pages/        # AdminDashboard, Inventario, Facturacion, Compras
└── index.ts      # Barrel público
```

## Reglas

- **No importar** desde `@/modules/admin-cms/components/...` fuera del módulo;
  usar el barrel `@/modules/admin-cms` o exponer un wrapper.
- Las tabs internas pueden seguir importándose entre sí con rutas relativas.
- Componentes compartidos (UI, seo, shared) viven fuera del módulo.

## Consumidores actuales

- `src/App.tsx` → `AdminDashboardPage`, `InventarioPage`, `FacturacionPage`, `ComprasPage`
- `src/pages/SuperadminDashboard.tsx` → tabs sueltos (OverviewTab, OrganizationsTab,
  ModulesTab, FiscalSettingsTab, SyncMonitor, SyncStatusTable, DeadLetterQueue,
  DataManagementTab) — siguen importándose por ruta directa para evitar cargar
  todo el bundle de admin en el panel superadmin.

## Próximo módulo a migrar

`superadmin` (`src/components/superadmin/*` + `SuperadminDashboard`, `Sitios`,
`Licencias`, `TenantWorkspace`, `CatalogosBase`).
