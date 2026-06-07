/**
 * Plantillas por tipo de negocio para el onboarding conversacional.
 * Cada plantilla preselecciona los módulos típicos y una ciudad sugerida.
 * Usado tanto por el wizard del Superadmin (TenantOnboardingWizard)
 * como por el onboarding del Dueño (pages/Onboarding).
 */
import {
  Store,
  UtensilsCrossed,
  Scissors,
  Briefcase,
  Croissant,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type BusinessKey =
  | "retail"
  | "horeca"
  | "panaderia"
  | "belleza"
  | "servicios"
  | "minimercado";

export interface BusinessTemplate {
  key: BusinessKey;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Módulos preseleccionados al elegir esta plantilla. */
  modules: string[];
  /** Nombre por defecto para la primera sucursal. */
  defaultLocation: string;
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    key: "retail",
    label: "Tienda / Retail",
    tagline: "Mostrador, inventario y código de barras.",
    icon: Store,
    modules: ["pos", "inventario", "crm", "retail"],
    defaultLocation: "Tienda principal",
  },
  {
    key: "horeca",
    label: "Restaurante",
    tagline: "Mesas, comandas y cocina (KDS).",
    icon: UtensilsCrossed,
    modules: ["pos", "mesas", "kds", "inventario", "horeca"],
    defaultLocation: "Sede principal",
  },
  {
    key: "panaderia",
    label: "Panadería / Café",
    tagline: "Venta rápida + producción diaria.",
    icon: Croissant,
    modules: ["pos", "inventario", "horeca"],
    defaultLocation: "Local principal",
  },
  {
    key: "belleza",
    label: "Belleza / Spa",
    tagline: "Citas, fichas de cliente y servicios.",
    icon: Scissors,
    modules: ["pos", "agenda", "crm", "belleza", "spa"],
    defaultLocation: "Sede principal",
  },
  {
    key: "minimercado",
    label: "Minimercado",
    tagline: "Caja rápida, peso y descuentos.",
    icon: ShoppingBag,
    modules: ["pos", "inventario", "retail"],
    defaultLocation: "Tienda",
  },
  {
    key: "servicios",
    label: "Servicios",
    tagline: "Facturación y agenda sin inventario.",
    icon: Briefcase,
    modules: ["pos", "crm", "agenda"],
    defaultLocation: "Oficina",
  },
];

export function getTemplate(key: string | null | undefined): BusinessTemplate {
  return (
    BUSINESS_TEMPLATES.find((b) => b.key === key) ?? BUSINESS_TEMPLATES[0]
  );
}

/** Catálogo completo de módulos (para el paso de ajuste fino). */
export const ALL_MODULES: Array<{ key: string; label: string }> = [
  { key: "pos", label: "POS / Caja" },
  { key: "inventario", label: "Inventario" },
  { key: "mesas", label: "Mesas" },
  { key: "kds", label: "KDS Cocina" },
  { key: "agenda", label: "Agenda / Citas" },
  { key: "crm", label: "CRM / Clientes" },
  { key: "horeca", label: "HORECA" },
  { key: "retail", label: "Retail" },
  { key: "belleza", label: "Belleza" },
  { key: "spa", label: "Spa" },
  { key: "representantes", label: "Representantes" },
  { key: "licencias", label: "Licencias Desktop" },
];
