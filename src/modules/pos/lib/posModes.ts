import { Utensils, ShoppingBag, Bike, Coffee, type LucideIcon } from "lucide-react";

export type PosMode = "mesa" | "autoservicio" | "domicilio" | "consumo_interno";

export interface PosModeMeta {
  key: PosMode;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

export const POS_MODES: Record<PosMode, PosModeMeta> = {
  mesa: {
    key: "mesa",
    label: "Mesa",
    short: "Mesa",
    icon: Utensils,
    description: "Servicio a la mesa con número de mesa y mesero",
  },
  autoservicio: {
    key: "autoservicio",
    label: "Autoservicio",
    short: "Autoservicio",
    icon: ShoppingBag,
    description: "Venta directa en caja (minimarket, ferretería, retail)",
  },
  domicilio: {
    key: "domicilio",
    label: "Domicilio",
    short: "Domicilio",
    icon: Bike,
    description: "Pedido con entrega a domicilio",
  },
  consumo_interno: {
    key: "consumo_interno",
    label: "Consumo interno",
    short: "Interno",
    icon: Coffee,
    description: "Consumo del personal o cortesías (no impacta caja)",
  },
};

export const ALL_POS_MODES: PosMode[] = ["mesa", "autoservicio", "domicilio", "consumo_interno"];
