import { useEffect } from "react";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";

/**
 * Convierte un hex (#RRGGBB) a triplete HSL "H S% L%" compatible con
 * los tokens del design system (hsl(var(--token))).
 */
const hexToHslTriplet = (hex: string): string | null => {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

/**
 * Inyecta los colores definidos por cada negocio (app_settings) como
 * variables CSS en :root, sobrescribiendo tanto los tokens legacy
 * (--surte-*) como los semánticos del design system (--primary, --accent, …).
 * Resultado: cada id_negocio re-pinta toda la app en runtime.
 */
const DynamicThemeInjector = () => {
  const { data: settings } = useAppSettings();

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    // Mapa: clave en DB -> lista de variables CSS a sobrescribir (HSL).
    const semanticMap: Record<string, string[]> = {
      color_primary: ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--surte-azul"],
      color_secondary: ["--secondary", "--surte-verde"],
      color_accent: ["--accent", "--surte-naranja"],
      color_tierra: ["--foreground", "--surte-navy-dark", "--surte-azul-dark"],
      color_cream: ["--background", "--surte-cream"],
      // Compatibilidad legacy
      color_azul_marino: ["--primary", "--surte-azul"],
      color_verde_campina: ["--secondary", "--surte-verde"],
      color_rojo_teja: ["--accent", "--surte-naranja"],
    };

    Object.entries(semanticMap).forEach(([dbKey, cssVars]) => {
      const hex = settings[dbKey];
      if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return;
      const hsl = hexToHslTriplet(hex);
      if (!hsl) return;
      cssVars.forEach((v) => root.style.setProperty(v, hsl));
    });

    // Refresca los gradientes derivados para que el cambio sea inmediato.
    const primary = getComputedStyle(root).getPropertyValue("--primary").trim();
    const navy = getComputedStyle(root).getPropertyValue("--surte-navy-dark").trim();
    const verde = getComputedStyle(root).getPropertyValue("--secondary").trim();
    const naranja = getComputedStyle(root).getPropertyValue("--accent").trim();
    if (primary && navy) {
      root.style.setProperty("--gradient-hero", `linear-gradient(135deg, hsl(${primary}), hsl(${navy}))`);
    }
    if (verde) {
      root.style.setProperty("--gradient-fresh", `linear-gradient(135deg, hsl(${verde}), hsl(${verde}))`);
      root.style.setProperty("--gradient-badge", `linear-gradient(135deg, hsl(${verde}), hsl(${verde}))`);
    }
    if (naranja) {
      root.style.setProperty("--gradient-cta", `linear-gradient(135deg, hsl(${naranja}), hsl(${naranja}))`);
    }
  }, [settings]);

  return null;
};

export default DynamicThemeInjector;
