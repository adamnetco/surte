/**
 * Redirects 301 desde sistecpos.lovable.app/* hacia sistecpos.com/* (Astro).
 * Mantener actualizado a medida que se migran páginas al CMS.
 * Estructura: { from: "/ruta-lovable", to: "/ruta-astro" }
 * Las rutas que NO estén aquí se sirven tal cual desde React (checkout, demo, representantes, CRM).
 */
export const SISTECPOS_LEGACY_REDIRECTS: Record<string, string> = {
  "/": "/",
  "/planes": "/planes",
  "/licencias": "/licencias",
  "/comparativa": "/comparativa",
  "/modulos": "/modulos",
  "/soluciones": "/soluciones",
  "/soluciones/restaurantes": "/soluciones/restaurantes",
  "/soluciones/retail": "/soluciones/retail",
  "/soluciones/minimercados": "/soluciones/minimercados",
  "/soluciones/spa": "/soluciones/spa",
  "/soluciones/peluqueria": "/soluciones/peluqueria",
  "/blog": "/blog",
  "/tienda": "/tienda",
  "/contacto": "/contacto",
  "/quienes-somos": "/quienes-somos",
  "/preguntas-frecuentes": "/preguntas-frecuentes",
};

/** Rutas que SE QUEDAN en React (NO redirigir): */
export const SISTECPOS_KEEP_IN_REACT = new Set<string>([
  "/checkout",
  "/agendar-demo",
  "/representantes",
  "/representantes/login",
  "/representantes/panel",
  "/crm",
  "/auth",
  "/auth/accept-invite",
]);
