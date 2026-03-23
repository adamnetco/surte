import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useStore";

/**
 * Injects app_settings color values as CSS custom properties on :root,
 * so admin color changes apply instantly across the entire app.
 */
const DynamicThemeInjector = () => {
  const { data: settings } = useAppSettings();

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    // Map DB keys → CSS variable names
    const colorMap: Record<string, string> = {
      color_primary: "--color-surte-azul",
      color_secondary: "--color-surte-verde",
      color_accent: "--color-surte-naranja",
      color_tierra: "--color-surte-tierra",
      color_cream: "--color-surte-cream",
      // Legacy keys from SettingsTab
      color_azul_marino: "--color-surte-azul",
      color_verde_campina: "--color-surte-verde",
      color_rojo_teja: "--color-surte-naranja",
    };

    Object.entries(colorMap).forEach(([dbKey, cssVar]) => {
      const hex = settings[dbKey];
      if (hex && hex.startsWith("#")) {
        root.style.setProperty(cssVar, hex);
      }
    });
  }, [settings]);

  return null;
};

export default DynamicThemeInjector;
