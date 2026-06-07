/**
 * Punto de entrada público del módulo POS.
 *
 * Etapa 1 del refactor (.lovable/plan.md): el resto de la app debe
 * importar SOLO desde aquí — nunca de `@/modules/pos/components/...`
 * directo. Lo que no esté exportado en este barril es interno al módulo.
 *
 * Si necesitas algo nuevo desde fuera de POS, añádelo aquí
 * conscientemente (y prefiere componer en lugar de exponer internos).
 */

// Páginas montadas en el router
export { default as POSPage } from "./pages/POS";
export { default as PosHubPage } from "./pages/PosHub";
export { default as KDSPage } from "./pages/KDS";
export { default as MenuPage } from "./pages/MenuPage";
export { default as MesasPage } from "./pages/Mesas";

// Hooks de configuración POS reutilizados por el admin
export { usePOSModes } from "./hooks/usePOSModes";

// Tipos/utilidades de modos POS consumidos por el panel admin
export {
  POS_MODE_PRESETS,
  type PosModeKey,
  type PosModeMeta,
} from "./lib/posModes";
