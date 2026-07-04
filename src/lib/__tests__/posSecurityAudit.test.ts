import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  insertMock: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingleMock: vi.fn().mockResolvedValue({ data: { primary_organization_id: "org-1" } }),
  getUserMock: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
  getSessionMock: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }),
}));
const { insertMock, maybeSingleMock, getUserMock, getSessionMock } = mocks;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mocks.getSessionMock, getUser: mocks.getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingleMock }) }) };
      }
      if (table === "sync_logs") return { insert: mocks.insertMock };
      return {};
    },
  },
}));

import { logPosSecurityEvent, resetPosSecurityAuditCache } from "../posSecurityAudit";

async function flushMicrotasks() {
  // queueMicrotask + awaits internos — dos ticks cubren el flush completo.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("posSecurityAudit", () => {
  beforeEach(() => {
    insertMock.mockClear();
    maybeSingleMock.mockClear();
    resetPosSecurityAuditCache();
  });

  it("registra pin_unlock como success con user_id y org", async () => {
    logPosSecurityEvent("pin_unlock", { trigger: "manual" });
    await flushMicrotasks();

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.organization_id).toBe("org-1");
    expect(payload.service_name).toBe("pos_security_pin_unlock");
    expect(payload.status).toBe("success");
    expect(payload.payload.user_id).toBe("user-1");
    expect(payload.payload.trigger).toBe("manual");
    expect(payload.payload.event).toBe("pin_unlock");
    expect(typeof payload.payload.at).toBe("string");
  });

  it("registra pin_unlock_failed con status warning", async () => {
    logPosSecurityEvent("pin_unlock_failed", { reason: "Confirma tu PIN" });
    await flushMicrotasks();

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].status).toBe("warning");
    expect(insertMock.mock.calls[0][0].payload.reason).toBe("Confirma tu PIN");
  });

  it("cachea la organización — sólo consulta profiles una vez por sesión", async () => {
    logPosSecurityEvent("pin_lock", { trigger: "idle" });
    logPosSecurityEvent("pin_lock", { trigger: "manual" });
    logPosSecurityEvent("pin_unlock");
    await flushMicrotasks();

    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(3);
  });

  it("no lanza si la sesión falta — falla en silencio", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    logPosSecurityEvent("pin_lock");
    await flushMicrotasks();

    expect(insertMock).not.toHaveBeenCalled();
  });
});
