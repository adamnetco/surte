import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";
type ThemePref = Theme | "system";

interface ThemeContextValue {
  theme: Theme;            // resolved active theme
  preference: ThemePref;   // stored user preference (may be 'system')
  setPreference: (p: ThemePref) => void;
  toggle: () => void;
}

const STORAGE_KEY = "tenant_theme_pref";
const LEGACY_KEY = "surteya_theme_pref";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getSystemTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const resolveTheme = (pref: ThemePref): Theme =>
  pref === "system" ? getSystemTheme() : pref;

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  // Update browser UI color (mobile address bar)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0a1928" : "#0C4B83");
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePref>(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)) as ThemePref | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch { /* ignore */ }
    return "system";
  });

  const [theme, setTheme] = useState<Theme>(() => resolveTheme(preference));

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Recompute when preference changes
  useEffect(() => {
    setTheme(resolveTheme(preference));
  }, [preference]);

  // Listen to system changes when on 'system'
  useEffect(() => {
    if (preference !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setTheme(getSystemTheme());
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference]);

  const setPreference = useCallback((p: ThemePref) => {
    setPreferenceState(p);
    try { localStorage.setItem(STORAGE_KEY, p); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [theme, setPreference]);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
