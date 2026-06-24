import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// ---- Mocks ----
const orderRow = {
  id: "ord-1",
  order_number: 1234,
  status: "confirmado",
  created_at: "2026-06-24T10:00:00Z",
  updated_at: "2026-06-24T10:05:00Z",
  total: 50000,
  subtotal: 45000,
  delivery_price: 5000,
  customer_name: "Test",
  customer_phone: "300",
  customer_address: "Calle 1",
  notes: null,
  payment_recorded_at: null,
  external_sync_sent_at: null,
  whatsapp_ref: "wa-ref-1",
  order_items: [{ id: "i1", quantity: 1, product_name: "Café", total_price: 50000 }],
};

let waEventsStore: any[] = [];
const channelCallbacks: Record<string, (p: any) => void> = {};

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = (table: string) => {
    const state: any = { table, filters: [] };
    const exec = async () => {
      if (table === "orders") return { data: orderRow, error: null };
      if (table === "whatsapp_message_events") return { data: waEventsStore, error: null };
      return { data: [], error: null };
    };
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: exec,
      then: (resolve: any) => exec().then(resolve),
    };
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => buildQuery(table),
      auth: { getUser: async () => ({ data: { user: { id: "u1", email: "tester@example.com" } } }) },
      channel: (_name: string) => {
        const ch: any = {
          on: (_evt: string, opts: any, cb: (p: any) => void) => {
            channelCallbacks[opts.table] = cb;
            return ch;
          },
          subscribe: () => ch,
        };
        return ch;
      },
      removeChannel: () => {},
      functions: { invoke: vi.fn(async () => ({ data: { success: true }, error: null })) },
    },
  };
});

vi.mock("@/modules/storefront/components/TopBar", () => ({ default: () => <div data-testid="topbar" /> }));
vi.mock("@/modules/storefront/components/BottomNav", () => ({ default: () => <div data-testid="bottomnav" /> }));
vi.mock("@/modules/marketing/seo/SeoBreadcrumbs", () => ({ default: () => null }));
vi.mock("@/modules/storefront/hooks/useStore", () => ({ useAppSettings: () => ({ data: { whatsapp_number: "300" } }) }));
vi.mock("sonner", () => {
  const fn: any = vi.fn();
  fn.success = vi.fn(); fn.error = vi.fn(); fn.info = vi.fn();
  return { toast: fn };
});

import Pedido from "../Pedido";

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/pedido/1234"]}>
        <Routes>
          <Route path="/pedido/:orderNumber" element={<Pedido />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("/pedido/:orderNumber", () => {
  beforeEach(() => {
    waEventsStore = [
      { id: "e1", order_id: "ord-1", whatsapp_ref: "wa-ref-1", status: "sent", error: null, created_at: "2026-06-24T10:01:00Z", payload: {} },
    ];
  });

  it("renderiza encabezado, total y bloque Historial", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Pedido #1234/)).toBeInTheDocument());
    expect(screen.getByTestId("historial-block")).toBeInTheDocument();
    expect(await screen.findByText(/WhatsApp enviado/)).toBeInTheDocument();
  });

  it("muestra detalle de reintento con actor, intento y motivo desde el payload", async () => {
    waEventsStore.push({
      id: "e2",
      order_id: "ord-1",
      whatsapp_ref: null,
      status: "retry_requested",
      error: null,
      created_at: "2026-06-24T10:02:00Z",
      payload: { attempt: 2, actor_name: "tester@example.com", reason: "No llegó" },
    });
    renderPage();
    expect(await screen.findByText(/intento #2/)).toBeInTheDocument();
    expect(screen.getByText(/por tester@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/motivo: "No llegó"/)).toBeInTheDocument();
  });

  it("refresca el historial al pulsar el botón de refrescar (refresco manual)", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("historial-block")).toBeInTheDocument());
    waEventsStore.push({
      id: "e2",
      order_id: "ord-1",
      whatsapp_ref: "wa-ref-1",
      status: "delivered",
      error: null,
      created_at: "2026-06-24T10:03:00Z",
      payload: {},
    });
    fireEvent.click(screen.getByTestId("refresh-historial"));
    expect(await screen.findByText(/WhatsApp entregado/)).toBeInTheDocument();
  });

  it("paginación 'Ver más' aparece cuando hay > TIMELINE_PAGE items y muestra skeleton al cargar", async () => {
    for (let i = 0; i < 25; i++) {
      waEventsStore.push({
        id: `bulk-${i}`,
        order_id: "ord-1",
        whatsapp_ref: "wa-ref-1",
        status: "delivered",
        error: null,
        created_at: `2026-06-24T10:${(10 + i).toString().padStart(2, "0")}:00Z`,
        payload: {},
      });
    }
    renderPage();
    const btn = await screen.findByTestId("load-more");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByTestId("paging-skeleton")).toBeInTheDocument();
  });

  it("se actualiza vía Realtime cuando llega un INSERT a whatsapp_message_events", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("historial-block")).toBeInTheDocument());
    waEventsStore.push({
      id: "rt-1",
      order_id: "ord-1",
      whatsapp_ref: "wa-ref-1",
      status: "read",
      error: null,
      created_at: "2026-06-24T10:04:00Z",
      payload: {},
    });
    // Simular el push del canal Realtime
    channelCallbacks["whatsapp_message_events"]?.({ new: { status: "read" } });
    expect(await screen.findByText(/WhatsApp leído/)).toBeInTheDocument();
  });
});
