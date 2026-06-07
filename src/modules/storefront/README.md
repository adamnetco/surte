# Storefront module

Tienda pública servida en hosts de tenant (ej. `surteya.sistecpos.com`).

## Estructura

```
modules/storefront/
├── components/   # Antes src/components/surte/*
├── pages/        # Catalogo, Carrito, Ofertas, ProductoDetalle, Pedido, Hub, LandingPage
└── index.ts      # API pública del módulo
```

## Reglas

- Las páginas se importan SOLO vía el barrel `@/modules/storefront`.
- Los componentes internos via `@/modules/storefront/components/<Name>`.
- No importar desde otros módulos (`pos`, `admin-cms`, `superadmin`).
- Hooks compartidos (`useStore`, `useFavorites`, `useProfile`) siguen en `src/hooks/*`
  hasta la Etapa 2 (capa de datos unificada con TanStack Query).

## Consumidores actuales

- `src/App.tsx` (rutas storefront: `/catalogo`, `/carrito`, `/ofertas`,
  `/producto/:id`, `/pedido/:orderNumber`, `/hub/...`, `/s/:slug`).
- Algunas páginas auxiliares (`Index`, `Favoritos`, `MisPedidos`,
  `Categorias`, etc.) reutilizan componentes del módulo
  (`TopBar`, `BottomNav`, `FloatingCart`, `ProductCard`, …).

## Próximo módulo

`admin-cms` (`src/components/admin/*` + `pages/AdminDashboard.tsx` + `Inventario`,
`Facturacion`, `Compras`).
