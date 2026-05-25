import type { PosMode } from "./posModes";
import { Utensils, ShoppingBasket, Wrench, Coffee, Scissors, Pill, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Plantillas POS por nicho de negocio.
 * Aplicar una plantilla pre-configura `pos_enabled_modes` + `pos_default_mode`
 * en la organización para que el cajero arranque con la UX justa para su rubro.
 */
export interface PosBusinessPreset {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  enabled: PosMode[];
  default: PosMode;
}

export const POS_BUSINESS_PRESETS: PosBusinessPreset[] = [
  {
    key: "restaurant",
    label: "Restaurante",
    description: "Mesa + Domicilio + Consumo interno. Servicio a la mesa por defecto.",
    icon: Utensils,
    enabled: ["mesa", "domicilio", "consumo_interno"],
    default: "mesa",
  },
  {
    key: "cafeteria",
    label: "Cafetería / Panadería",
    description: "Mostrador rápido y domicilio. Sin servicio a la mesa formal.",
    icon: Coffee,
    enabled: ["autoservicio", "domicilio", "consumo_interno"],
    default: "autoservicio",
  },
  {
    key: "minimarket",
    label: "Minimercado / Tienda",
    description: "Autoservicio en caja. Domicilio opcional para barrio.",
    icon: ShoppingBasket,
    enabled: ["autoservicio", "domicilio"],
    default: "autoservicio",
  },
  {
    key: "ferreteria",
    label: "Ferretería",
    description: "Mostrador con domicilio. Sin mesa.",
    icon: Wrench,
    enabled: ["autoservicio", "domicilio"],
    default: "autoservicio",
  },
  {
    key: "salon",
    label: "Salón / Spa",
    description: "Servicio a turno (mesa = silla/cabina) más consumo interno.",
    icon: Scissors,
    enabled: ["mesa", "consumo_interno"],
    default: "mesa",
  },
  {
    key: "farmacia",
    label: "Farmacia / Droguería",
    description: "Caja rápida + domicilio express.",
    icon: Pill,
    enabled: ["autoservicio", "domicilio"],
    default: "autoservicio",
  },
  {
    key: "mayorista",
    label: "Mayorista / Distribuidor",
    description: "Pedidos por ruta y mostrador. Sin mesa.",
    icon: Truck,
    enabled: ["autoservicio", "domicilio"],
    default: "domicilio",
  },
  {
    key: "retail",
    label: "Retail genérico",
    description: "Configuración estándar con los 4 modos disponibles.",
    icon: Store,
    enabled: ["mesa", "autoservicio", "domicilio", "consumo_interno"],
    default: "autoservicio",
  },
];

export const getPresetByKey = (key: string) =>
  POS_BUSINESS_PRESETS.find((p) => p.key === key);
