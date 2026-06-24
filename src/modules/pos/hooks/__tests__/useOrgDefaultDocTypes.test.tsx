import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const selectMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              limit: (_n: number) => selectMock(),
            }),
          }),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

import { useOrgDefaultDocTypes } from "../useOrgDefaultDocTypes";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => selectMock.mockReset());

describe("useOrgDefaultDocTypes (React Query)", () => {
  it("retorna FALLBACK cuando organizationId es null", () => {
    const { result } = renderHook(() => useOrgDefaultDocTypes(null), { wrapper: wrapper() });
    expect(result.current.consumerFinal).toBe("pos_electronico");
    expect(result.current.withNit).toBe("factura_electronica");
    expect(result.current.fxOperation).toBe("documento_soporte");
    expect(result.current.loading).toBe(false);
  });

  it("lee defaults personalizados de la fila activa", async () => {
    selectMock.mockResolvedValueOnce({
      data: [
        {
          default_doc_type_consumer_final: "documento_soporte",
          default_doc_type_with_nit: "documento_soporte",
          default_doc_type_fx_operation: "documento_soporte",
          is_active: true,
        },
      ],
    });
    const { result } = renderHook(() => useOrgDefaultDocTypes("org-fx"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consumerFinal).toBe("documento_soporte");
    expect(result.current.withNit).toBe("documento_soporte");
  });

  it("cae al FALLBACK si la org no tiene einvoice_config", async () => {
    selectMock.mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useOrgDefaultDocTypes("org-sin-config"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consumerFinal).toBe("pos_electronico");
    expect(result.current.withNit).toBe("factura_electronica");
  });

  it("soporta sandbox 'dev' (no filtra por environment)", async () => {
    selectMock.mockResolvedValueOnce({
      data: [
        {
          default_doc_type_consumer_final: "factura_electronica",
          default_doc_type_with_nit: "factura_electronica",
          default_doc_type_fx_operation: "documento_soporte",
          is_active: false,
        },
      ],
    });
    const { result } = renderHook(() => useOrgDefaultDocTypes("org-dev"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consumerFinal).toBe("factura_electronica");
  });

  it("cache scoped por orgId: queries de orgs distintas no se contaminan", async () => {
    selectMock
      .mockResolvedValueOnce({
        data: [{ default_doc_type_consumer_final: "documento_soporte", default_doc_type_with_nit: "documento_soporte", default_doc_type_fx_operation: "documento_soporte" }],
      })
      .mockResolvedValueOnce({
        data: [{ default_doc_type_consumer_final: "pos_electronico", default_doc_type_with_nit: "factura_electronica", default_doc_type_fx_operation: "documento_soporte" }],
      });
    const W = wrapper();
    const a = renderHook(() => useOrgDefaultDocTypes("org-A"), { wrapper: W });
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    const b = renderHook(() => useOrgDefaultDocTypes("org-B"), { wrapper: W });
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    expect(a.result.current.consumerFinal).toBe("documento_soporte");
    expect(b.result.current.consumerFinal).toBe("pos_electronico");
  });
});
