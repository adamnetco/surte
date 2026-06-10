/**
 * Mapa de rutas → label legible para breadcrumbs y títulos.
 * Usar segmentos exactos. Para rutas dinámicas, el componente
 * `AppBreadcrumb` cae al segmento crudo (capitalizado).
 */
export const ROUTE_LABELS: Record<string, string> = {
  "": "Inicio",
  pos: "POS",
  vender: "Vender",
  mesas: "Mesas",
  kds: "KDS Cocina",
  inventario: "Inventario",
  compras: "Compras",
  facturacion: "Facturación",
  admin: "Administración",
  sitios: "Sitios web",
  onboarding: "Onboarding",
  activacion: "Estado de activación",
  ayuda: "Ayuda",
  perfil: "Perfil",
  configuracion: "Configuración",
  clientes: "Clientes",
  "gerente-ia": "Gerente IA",
};

/**
 * Devuelve la ruta "padre" lógica para volver atrás cuando
 * `navigate(-1)` no es una opción (por ejemplo, deep-link directo).
 */
export const PARENT_ROUTE: Record<string, string> = {
  "/pos/vender": "/pos",
  "/mesas": "/pos",
  "/kds": "/pos",
  "/inventario": "/pos",
  "/compras": "/pos",
  "/facturacion": "/pos",
  "/sitios": "/pos",
  "/activacion": "/pos",
  "/onboarding": "/clientes",
};
