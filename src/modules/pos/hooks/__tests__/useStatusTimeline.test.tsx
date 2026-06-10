import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStatusTimeline } from "../useStatusTimeline";

// Avoid hitting Supabase in unit tests.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [] }),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("useStatusTimeline", () => {
  beforeEach(() => localStorage.clear());

  it("no registra entrada en el primer estado conocido (baseline)", () => {
    const { result } = renderHook(() => useStatusTimeline("printer", "ok", "local"));
    expect(result.current.entries).toEqual([]);
  });

  it("registra transiciones consecutivas y formatea con flecha", () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: "ok" | "warn" | "off" }) =>
        useStatusTimeline("printer", s, "local"),
      { initialProps: { s: "ok" as const } },
    );
    act(() => rerender({ s: "warn" }));
    act(() => rerender({ s: "off" }));
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]).toMatchObject({ from: "warn", to: "off" });
    expect(result.current.formatted[0]).toMatch(/warn → off/);
  });

  it("persiste el historial en localStorage por source+scope", () => {
    const { rerender } = renderHook(
      ({ s }: { s: "ok" | "warn" }) =>
        useStatusTimeline("core", s, "org-1"),
      { initialProps: { s: "ok" as const } },
    );
    act(() => rerender({ s: "warn" }));
    const raw = localStorage.getItem("sistecpos.timeline.core.org-1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed[0]).toMatchObject({ from: "ok", to: "warn" });
  });

  it("ignora transiciones a 'unknown'", () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: "ok" | "unknown" }) =>
        useStatusTimeline("wp", s, "local"),
      { initialProps: { s: "ok" as const } },
    );
    act(() => rerender({ s: "unknown" }));
    expect(result.current.entries).toEqual([]);
  });
});
