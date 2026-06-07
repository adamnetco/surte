/**
 * Storefront module — tienda pública para cada tenant.
 *
 * Toda la UI de catálogo, carrito, ofertas, hubs SEO, landings,
 * detalle de producto y seguimiento de pedidos vive aquí.
 *
 * Reglas:
 *  - Importar páginas SOLO vía este barrel (`@/modules/storefront`).
 *  - Componentes internos via `@/modules/storefront/components/<X>`.
 *  - No depender de otros módulos (pos, admin-cms, superadmin).
 */
export { default as CatalogoPage } from "./pages/Catalogo";
export { default as CarritoPage } from "./pages/Carrito";
export { default as OfertasPage } from "./pages/Ofertas";
export { default as ProductoDetallePage } from "./pages/ProductoDetalle";
export { default as PedidoPage } from "./pages/Pedido";
export { default as HubPage } from "./pages/Hub";
export { default as LandingPagePage } from "./pages/LandingPage";
