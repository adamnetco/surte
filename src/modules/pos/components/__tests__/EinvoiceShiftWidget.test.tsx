import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// --- Mocks ---
const invokeMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invokeMock(...args) },
    from: (...args: any[]) => fromMock(...args),
  },
}));

vi.mock("@/modules/pos/hooks/useShiftDocsStats", () => ({
  useShiftDocsStats: () => ({ loading: false, total: 5, ok: 2, retry: 2, error: 1 }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import EinvoiceShiftWidget from "../EinvoiceShiftWidget";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
  // stub para loadRecent: cadena .select().eq().gte().order().limit()
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: async () => ({ data: [] }),
  };
  fromMock.mockReturnValue(chain);
  // window.confirm → true por defecto
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("EinvoiceShiftWidget — POS-einvoice-retry-scoping AC3", () => {
  it("envía organization_id en dry_run y en la ejecución real", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: { success: true, dry_run: true, candidates: 3 }, error: null }) // preview
      .mockResolvedValueOnce({ data: { success: true, requeued: 3 }, error: null }); // commit

    render(<EinvoiceShiftWidget organizationId={ORG_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Docs 5/i }));
    await waitFor(() => screen.getByText(/Reintentar pendientes/i));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar pendientes/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    expect(invokeMock).toHaveBeenNthCalledWith(1, "einvoice-resend", {
      body: { action: "retry_all_today", organization_id: ORG_ID, dry_run: true },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "einvoice-resend", {
      body: { action: "retry_all_today", organization_id: ORG_ID },
    });
  });

  it("aborta sin mutación cuando dry_run reporta 0 candidatos", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { success: true, dry_run: true, candidates: 0 },
      error: null,
    });

    render(<EinvoiceShiftWidget organizationId={ORG_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Docs 5/i }));
    await waitFor(() => screen.getByText(/Reintentar pendientes/i));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar pendientes/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    // No hay segundo invoke (no commit).
  });

  it("respeta cancelación del usuario en el confirm", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    invokeMock.mockResolvedValueOnce({
      data: { success: true, dry_run: true, candidates: 7 },
      error: null,
    });

    render(<EinvoiceShiftWidget organizationId={ORG_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Docs 5/i }));
    await waitFor(() => screen.getByText(/Reintentar pendientes/i));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar pendientes/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
  });
});
