import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Trash2, Plus, Minus, CreditCard, LogOut, FileText, FileSignature, Pause, Keyboard } from "lucide-react";
import PaymentDialog from "./PaymentDialog";
import CloseSessionDialog from "./CloseSessionDialog";
import InvoiceActionsDialog from "./InvoiceActionsDialog";
import OfflineIndicator from "@/components/OfflineIndicator";
import { refreshCatalogCache, getCachedProducts } from "@/lib/offline/catalog";
import { setMeta, getMeta } from "@/lib/offline/db";
import { usePOSHotkeys } from "@/hooks/usePOSHotkeys";


interface Product { id: string; name: string; price: number; image_url: string | null; stock: number; }
interface TicketLine {
  productId: string; name: string; unitPrice: number; quantity: number; total: number;
}
interface Props {
  session: { id: string; location_id: string; cash_register_id: string; opening_amount: number; opened_at: string };
  organizationId: string;
  userId: string;
  onClosed: () => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function POSWorkspace({ session, organizationId, userId, onClosed }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [actionMode, setActionMode] = useState<"emit" | "quote" | "park" | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const ticketCacheKey = `pos_ticket:${session.id}`;

  // Hydrate catalog + persisted ticket
  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedProducts();
        if (cached.length) {
          setProducts(cached as Product[]);
          setLoading(false);
        }
      } catch { /* no cache yet */ }

      try {
        const savedTicket = await getMeta<TicketLine[]>(ticketCacheKey);
        if (savedTicket && Array.isArray(savedTicket) && savedTicket.length) {
          setTicket(savedTicket);
        }
      } catch { /* no ticket cached */ }

      try {
        await refreshCatalogCache();
        const fresh = await getCachedProducts();
        if (fresh.length) setProducts(fresh as Product[]);
      } catch {
        // Offline or error — keep cached
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Persist every ticket change to IndexedDB BEFORE any backend roundtrip.
  useEffect(() => {
    setMeta(ticketCacheKey, ticket).catch(() => { /* dexie unavailable */ });
  }, [ticket, ticketCacheKey]);

  // Hotkeys: F2 cobrar · F3 buscar · Esc cierre Z
  usePOSHotkeys({
    onPay: () => { if (ticket.length > 0) setPayOpen(true); },
    onSearch: () => searchRef.current?.focus(),
    onEscape: () => setCloseOpen(true),
  });


  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const totals = useMemo(() => {
    const subtotal = ticket.reduce((s, l) => s + l.total, 0);
    return { subtotal, total: subtotal };
  }, [ticket]);

  const addProduct = (p: Product) => {
    setTicket((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1, total: (copy[i].quantity + 1) * copy[i].unitPrice };
        return copy;
      }
      return [...prev, { productId: p.id, name: p.name, unitPrice: Number(p.price), quantity: 1, total: Number(p.price) }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setTicket((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l];
        const q = l.quantity + delta;
        if (q <= 0) return [];
        return [{ ...l, quantity: q, total: q * l.unitPrice }];
      })
    );
  };

  const removeLine = (productId: string) => setTicket((prev) => prev.filter((l) => l.productId !== productId));

  const handlePaid = async (payments: { method: string; amount: number; reference?: string }[]) => {
    // 1) create pos_order
    const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
    const change = Math.max(0, amountPaid - totals.total);

    const { data: order, error: oerr } = await supabase
      .from("pos_orders")
      .insert({
        organization_id: organizationId,
        location_id: session.location_id,
        cash_session_id: session.id,
        cashier_id: userId,
        subtotal: totals.subtotal,
        total: totals.total,
        amount_paid: amountPaid,
        change_due: change,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (oerr || !order) return toast.error(oerr?.message || "Error creando ticket");

    // 2) items
    const itemsPayload = ticket.map((l) => ({
      organization_id: organizationId,
      pos_order_id: order.id,
      product_id: l.productId,
      product_name: l.name,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      total: l.total,
    }));
    const { error: ierr } = await supabase.from("pos_order_items").insert(itemsPayload);
    if (ierr) return toast.error(ierr.message);

    // 3) payments
    const paysPayload = payments.map((p) => ({
      organization_id: organizationId,
      pos_order_id: order.id,
      cash_session_id: session.id,
      method: p.method,
      amount: p.amount,
      reference: p.reference ?? null,
      received_by: userId,
    }));
    const { error: perr } = await supabase.from("pos_payments").insert(paysPayload);
    if (perr) return toast.error(perr.message);

    toast.success(`Ticket #${order.ticket_number} cobrado`);
    setLastOrderId(order.id);
    setTicket([]);
    setMeta(ticketCacheKey, []).catch(() => {});
    setPayOpen(false);

    // Auto-prompt: ¿facturar?
    setTimeout(() => {
      if (confirm("¿Emitir factura electrónica DIAN para este ticket?")) {
        setActionMode("emit");
      }
    }, 300);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-muted/30">
      {/* Catalogo */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-3 bg-card border-b flex gap-2 items-center sticky top-0 z-10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar producto…  (F3)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
          <OfflineIndicator />
          <div
            className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded-md px-2 py-1"
            title="Atajos: F2 Cobrar · F3 Buscar · Esc Cierre"
          >
            <Keyboard className="w-3 h-3" />
            <span><kbd className="px-1 bg-muted rounded">F2</kbd> Cobrar · <kbd className="px-1 bg-muted rounded">F3</kbd> Buscar · <kbd className="px-1 bg-muted rounded">Esc</kbd> Cierre</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
            <LogOut className="w-4 h-4 mr-1" /> Cierre Z

          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="bg-card rounded-lg border hover:border-primary hover:shadow-sm transition text-left overflow-hidden active:scale-95"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">Sin imagen</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{p.name}</p>
                    <p className="text-sm font-bold text-primary mt-1">{COP(Number(p.price))}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticket */}
      <div className="lg:w-96 bg-card border-t lg:border-t-0 lg:border-l flex flex-col max-h-[60dvh] lg:max-h-none">
        <div className="p-3 border-b flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Ticket</h2>
          <span className="ml-auto text-xs text-muted-foreground">{ticket.length} ítems</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {ticket.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Sin productos</p>
          ) : (
            ticket.map((l) => (
              <div key={l.productId} className="bg-muted/40 rounded-lg p-2 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-medium flex-1">{l.name}</p>
                  <button onClick={() => removeLine(l.productId)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(l.productId, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{l.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(l.productId, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold">{COP(l.total)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-3 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{COP(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{COP(totals.total)}</span>
          </div>
          <Button
            className="w-full h-12 text-base"
            disabled={ticket.length === 0}
            onClick={() => setPayOpen(true)}
            style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
          >
            <CreditCard className="w-5 h-5 mr-2" /> Cobrar
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" disabled={!lastOrderId} onClick={() => setActionMode("emit")} title="Facturar último ticket">
              <FileSignature className="w-4 h-4 mr-1" /> Facturar
            </Button>
            <Button variant="outline" size="sm" disabled={ticket.length === 0} onClick={() => setActionMode("quote")}>
              <FileText className="w-4 h-4 mr-1" /> Cotizar
            </Button>
            <Button variant="outline" size="sm" disabled={ticket.length === 0} onClick={() => setActionMode("park")}>
              <Pause className="w-4 h-4 mr-1" /> Suspender
            </Button>
          </div>
        </div>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={totals.total}
        onConfirm={handlePaid}
      />

      <InvoiceActionsDialog
        open={!!actionMode}
        onOpenChange={(v) => !v && setActionMode(null)}
        mode={actionMode ?? "emit"}
        organizationId={organizationId}
        locationId={session.location_id}
        cashSessionId={session.id}
        userId={userId}
        ticket={ticket}
        subtotal={totals.subtotal}
        total={totals.total}
        posOrderId={lastOrderId ?? undefined}
        onDone={() => { if (actionMode !== "emit") setTicket([]); }}
      />

      <CloseSessionDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        sessionId={session.id}
        openingAmount={Number(session.opening_amount)}
        organizationId={organizationId}
        userId={userId}
        onClosed={onClosed}
      />
    </div>
  );
}
