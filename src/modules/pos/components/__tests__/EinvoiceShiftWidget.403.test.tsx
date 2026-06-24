import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// Reproduce el contrato 403 del edge function en el front: el widget debe
// mostrar el error y NO disparar la mutación. Cubre POS-einvoice-retry-scoping AC2
// desde la perspectiva del cliente (sin levantar Deno).
const invokeMock = vi.fn();
const fromMock = vi.fn();
const toastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: any[]) => invokeMock(...a) },
    from: (...a: any[]) => fromMock(...a),
  },
}));
vi.mock("@/modules/pos/hooks/useShiftDocsStats", () => ({
  useShiftDocsStats: () => ({ loading: false, total: 5, ok: 2, retry: 2, error: 1 }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: any[]) => toastError(...a), info: vi.fn() },
}));

import EinvoiceShiftWidget from "../EinvoiceShiftWidget";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  invokeMock.mockReset();
  toastError.mockReset();
  const chain: any = {
    select: () => chain, eq: () => chain, gte: () => chain, order: () => chain,
    limit: async () => ({ data: [] }),
  };
  fromMock.mockReturnValue(chain);
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("EinvoiceShiftWidget — 403 admin_required_for_org", () => {
  it("muestra error y no ejecuta commit cuando el dry_run devuelve 403", async () => {
    // El edge devuelve error 403 en el primer invoke (preview).
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "admin_required_for_org", status: 403 },
    });

    render(<EinvoiceShiftWidget organizationId={ORG_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Docs 5/i }));
    await waitFor(() => screen.getByText(/Reintentar pendientes/i));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar pendientes/i }));

    // Solo 1 invoke (preview); no debe haber commit posterior.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenCalledWith("einvoice-resend", {
      body: { action: "retry_all_today", organization_id: ORG_ID, dry_run: true },
    });
    // Toast de error visible al usuario.
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
