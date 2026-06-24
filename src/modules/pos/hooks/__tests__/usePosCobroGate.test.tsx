import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// --- Mock useDianHealth: controlable por test ---
let healthMock = { health: "online" as "online" | "degraded" | "offline" | "unknown", hasContingencyRange: false };
vi.mock("../useDianHealth", () => ({
  useDianHealth: () => healthMock,
}));

// --- Mock supabase: lectura del flag + insert audit + realtime no-op ---
let hardBlockFlag = false;
const insertSpy = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => {
      if (table === "einvoice_configs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { hard_block_when_dian_down: hardBlockFlag },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "sync_logs") {
        return { insert: insertSpy };
      }
      return {};
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  },
}));

import { usePosCobroGate } from "../usePosCobroGate";

const ORG = "org-1";

describe("usePosCobroGate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    insertSpy.mockClear();
    healthMock = { health: "online", hasContingencyRange: false };
    hardBlockFlag = false;
  });

  it("QA#1: flag OFF + DIAN down + sin contingencia → cobra (no regresión)", async () => {
    hardBlockFlag = false;
    healthMock = { health: "offline", hasContingencyRange: false };
    const { result } = renderHook(() => usePosCobroGate(ORG, "pos_electronico"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCharge).toBe(true);
    expect(result.current.reason).toBe("ok");
  });

  it("QA#2: flag ON + DIAN down + sin contingencia → bloqueado", async () => {
    hardBlockFlag = true;
    healthMock = { health: "offline", hasContingencyRange: false };
    const { result } = renderHook(() => usePosCobroGate(ORG, "pos_electronico"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCharge).toBe(false);
    expect(result.current.reason).toBe("dian_down_no_contingency");
  });

  it("QA#3: flag ON + DIAN down + contingencia vigente → cobra", async () => {
    hardBlockFlag = true;
    healthMock = { health: "offline", hasContingencyRange: true };
    const { result } = renderHook(() => usePosCobroGate(ORG, "pos_electronico"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCharge).toBe(true);
  });

  it("QA#4: flag ON + DIAN ok → cobra", async () => {
    hardBlockFlag = true;
    healthMock = { health: "online", hasContingencyRange: false };
    const { result } = renderHook(() => usePosCobroGate(ORG, "pos_electronico"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCharge).toBe(true);
  });

  it("QA#5 (AC4): flag ON + DIAN down + doc type recibo_interno → bypass", async () => {
    hardBlockFlag = true;
    healthMock = { health: "offline", hasContingencyRange: false };
    const { result } = renderHook(() => usePosCobroGate(ORG, "recibo_interno"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCharge).toBe(true);
  });

  it("QA#6 (AC5): activateOverride desbloquea, persiste en sessionStorage e inserta auditoría", async () => {
    hardBlockFlag = true;
    healthMock = { health: "offline", hasContingencyRange: false };
    const { result } = renderHook(() => usePosCobroGate(ORG, "pos_electronico"));
    await waitFor(() => expect(result.current.canCharge).toBe(false));

    await act(async () => {
      await result.current.activateOverride();
    });

    expect(result.current.overrideActive).toBe(true);
    expect(result.current.canCharge).toBe(true);
    expect(result.current.reason).toBe("override_active");
    expect(sessionStorage.getItem(`pos:hard_block_override:${ORG}`)).toBeTruthy();
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.service_name).toBe("pos_hard_block_override");
    expect(payload.status).toBe("warning");
    expect(payload.organization_id).toBe(ORG);
    expect(payload.payload.dian_health).toBe("offline");
  });

  it("override expirado (TTL > 30 min) se descarta", async () => {
    hardBlockFlag = true;
    healthMock = { health: "offline", hasContingencyRange: false };
    const oldTs = Date.now() - 31 * 60 * 1000;
    sessionStorage.setItem(`pos:hard_block_override:${ORG}`, String(oldTs));

    const { result } = renderHook(() => usePosCobroGate(ORG, "pos_electronico"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.overrideActive).toBe(false);
    expect(result.current.canCharge).toBe(false);
    expect(sessionStorage.getItem(`pos:hard_block_override:${ORG}`)).toBeNull();
  });
});
