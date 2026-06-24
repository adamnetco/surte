import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// --- Mock supabase client ---
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
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  },
}));

import { useOrgDefaultDocTypes, __resetOrgDefaultDocTypesCache } from "../useOrgDefaultDocTypes";

beforeEach(() => {
  __resetOrgDefaultDocTypesCache();
  selectMock.mockReset();
});

describe("useOrgDefaultDocTypes", () => {
  it("retorna FALLBACK cuando organizationId es null", () => {
    const { result } = renderHook(() => useOrgDefaultDocTypes(null));
    expect(result.current.consumerFinal).toBe("pos_electronico");
    expect(result.current.withNit).toBe("factura_electronica");
    expect(result.current.fxOperation).toBe("documento_soporte");
    expect(result.current.loading).toBe(false);
  });

  it("lee defaults personalizados de la fila más reciente", async () => {
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
    const { result } = renderHook(() => useOrgDefaultDocTypes("org-fx"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consumerFinal).toBe("documento_soporte");
    expect(result.current.withNit).toBe("documento_soporte");
  });

  it("cae al FALLBACK si la org no tiene einvoice_config", async () => {
    selectMock.mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useOrgDefaultDocTypes("org-sin-config"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consumerFinal).toBe("pos_electronico");
    expect(result.current.withNit).toBe("factura_electronica");
    expect(result.current.fxOperation).toBe("documento_soporte");
  });

  it("no filtra por environment='prod' (soporta tenants en sandbox 'dev')", async () => {
    // Si filtrara, .limit retornaría [] en este escenario y caería al fallback.
    selectMock.mockResolvedValueOnce({
      data: [
        {
          default_doc_type_consumer_final: "factura_electronica",
          default_doc_type_with_nit: "factura_electronica",
          default_doc_type_fx_operation: "documento_soporte",
          is_active: false, // dev environment, no activa todavía
        },
      ],
    });
    const { result } = renderHook(() => useOrgDefaultDocTypes("org-dev"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.consumerFinal).toBe("factura_electronica");
  });
});
