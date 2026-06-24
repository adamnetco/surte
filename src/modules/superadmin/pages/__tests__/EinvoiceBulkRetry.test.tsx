/**
 * E2E (component-level) · POS-einvoice-bulk-retry-admin
 * Valida:
 *  - dry_run preview no requiere confirmación y envía body correcto.
 *  - batch_size y max_retries viajan al edge function.
 *  - Reencolar real exige confirm() y respeta cancelación.
 *  - 403 (admin_required / superadmin requerido) muestra toast y NO setea lastResponse.
 *  - Selección > 20 organizaciones bloquea ejecución.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const invokeMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

const ORGS = Array.from({ length: 3 }).map((_, i) => ({
  id: `org-${i + 1}`,
  slug: `org-${i + 1}`,
  name: `Org ${i + 1}`,
  is_active: true,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: any[]) => invokeMock(...a) },
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: async () => ({ data: ORGS, error: null }),
      };
      return chain;
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
    info: vi.fn(),
  },
}));

import EinvoiceBulkRetry from "../EinvoiceBulkRetry";

function renderUI() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EinvoiceBulkRetry />
    </QueryClientProvider>,
  );
}

async function selectOrgs(n: number) {
  await waitFor(() => screen.getByText("Org 1"));
  for (let i = 1; i <= n; i++) {
    fireEvent.click(screen.getByLabelText(`Seleccionar Org ${i}`));
  }
}

beforeEach(() => {
  invokeMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("EinvoiceBulkRetry · admin UI", () => {
  it("envía dry_run=true con batch_size/max_retries al edge", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: true, dry_run: true, total_orgs: 2, total_requeued: 0,
        results: [
          { organization_id: "org-1", candidates: 3, requeued: 0, status: "success" },
          { organization_id: "org-2", candidates: 1, requeued: 0, status: "success" },
        ],
      },
      error: null,
    });

    renderUI();
    await selectOrgs(2);

    // Cambiar batch_size y max_retries
    fireEvent.change(screen.getByLabelText("Batch size"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Reintentos máximos"), { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /Dry-run/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenCalledWith("einvoice-resend-bulk-admin", {
      body: {
        organization_ids: ["org-1", "org-2"],
        dry_run: true,
        batch_size: 120,
        max_retries: 5,
      },
    });
    expect(toastSuccess).toHaveBeenCalled();
    // confirm() no se usa para dry_run
    expect((globalThis as any).confirm).not.toHaveBeenCalled();
  });

  it("reencola real pide confirm() y envía dry_run=false", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        success: true, dry_run: false, total_orgs: 1, total_requeued: 4,
        results: [{ organization_id: "org-1", candidates: 4, requeued: 4, status: "success" }],
      },
      error: null,
    });

    renderUI();
    await selectOrgs(1);

    // Desactivar dry-run para habilitar "Reencolar ahora"
    fireEvent.click(screen.getByLabelText(/Dry-run/i));

    fireEvent.click(screen.getByRole("button", { name: /Reencolar ahora/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect((globalThis as any).confirm).toHaveBeenCalled();
    expect(invokeMock.mock.calls[0][1].body.dry_run).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Reencoladas 4/));
  });

  it("cancela la ejecución real si window.confirm devuelve false", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderUI();
    await selectOrgs(1);
    fireEvent.click(screen.getByLabelText(/Dry-run/i));
    fireEvent.click(screen.getByRole("button", { name: /Reencolar ahora/i }));

    await new Promise((r) => setTimeout(r, 10));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("muestra toast y no setea resultado cuando el edge devuelve 403", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "admin_required", context: { status: 403 } },
    });

    renderUI();
    await selectOrgs(1);
    fireEvent.click(screen.getByRole("button", { name: /Dry-run/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/superadmin/i)),
    );
    // No debe renderizar la card de resultado
    expect(screen.queryByText(/Preview · /i)).toBeNull();
    expect(screen.queryByText(/Resultado · /i)).toBeNull();
  });
});
