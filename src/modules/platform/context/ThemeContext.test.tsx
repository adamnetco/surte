import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system preference and resolves a theme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.preference).toBe("system");
    expect(["light", "dark"]).toContain(result.current.theme);
  });

  it("setPreference persists and applies the dark class", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setPreference("dark"));
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("surteya_theme_pref")).toBe("dark");
  });

  it("toggle switches between dark and light", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setPreference("light"));
    expect(result.current.theme).toBe("light");
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("dark");
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("light");
  });
});
