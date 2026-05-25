import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Search, FileText, FileSignature, Pause, Keyboard, Printer,
  CloudUpload, CloudOff, Loader2, ScanLine, CreditCard, User, Percent, StickyNote, ArrowLeftRight,
} from "lucide-react";
import PaymentDialog from "./PaymentDialog";
import CloseSessionDialog from "./CloseSessionDialog";
import InvoiceActionsDialog from "./InvoiceActionsDialog";
import OfflineIndicator from "@/components/OfflineIndicator";
import {
  refreshCatalogCache, getCachedProducts, getCachedCategories,
} from "@/lib/offline/catalog";
import { setMeta, getMeta } from "@/lib/offline/db";
import { usePOSHotkeys } from "@/hooks/usePOSHotkeys";
import { useSyncService } from "@/hooks/useSyncService";
import { enqueue } from "@/lib/offline/outbox";
import POSTopBar from "./POSTopBar";
import POSCategoryTabs from "./POSCategoryTabs";
import POSCommandPalette from "./POSCommandPalette";
import POSScannerListener from "./POSScannerListener";
import POSShortcutsOverlay from "./POSShortcutsOverlay";
import TicketLineRow, { type TicketLineData } from "./TicketLineRow";
import { usePOSModes } from "@/hooks/usePOSModes";
import { POS_MODES } from "@/lib/posModes";
import { supabase } from "@/integrations/supabase/client";
import type { PosMode } from "@/lib/posModes";


interface Product {
  id: string; name: string; price: number;
  image_url: string | null; stock: number;
  category_id?: string | null; sku?: string | null; gtin?: string | null;
}
interface Category { id: string; name: string; }
type TicketLine = TicketLineData;
interface Props {
  session: { id: string; location_id: string; cash_register_id: string; opening_amount: number; opened_at: string };
  organizationId: string;
  userId: string;
  onClosed: () => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const TAX_RATE = 0; // TODO: leer de organizations.settings cuando se configure por org.


export default function POSWorkspace({ session, organizationId, userId, onClosed }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [actionMode, setActionMode] = useState<"emit" | "quote" | "park" | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cashierName, setCashierName] = useState("Cajero");
  const searchRef = useRef<HTMLInputElement>(null);
  const sync = useSyncService();
  const { config: posModes } = usePOSModes(organizationId);
  const [saleMode, setSaleMode] = useState<PosMode>(posModes.default);

  useEffect(() => {
    if (!posModes.enabled.includes(saleMode)) setSaleMode(posModes.default);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posModes.enabled.join(","), posModes.default]);

  // Cargar nombre del cajero (best-effort).
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.full_name) setCashierName(data.full_name);
    })();
  }, [userId]);

  const ticketCacheKey = `pos_ticket:${session.id}`;

  // Hydrate catalog + persisted ticket
  useEffect(() => {
    (async () => {
      try {
        const [cached, cats] = await Promise.all([getCachedProducts(), getCachedCategories()]);
        if (cached.length) {
          setProducts(cached as Product[]);
          setLoading(false);
        }
        if (cats.length) setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
      } catch { /* no cache */ }

      try {
        const savedTicket = await getMeta<TicketLine[]>(ticketCacheKey);
        if (savedTicket && Array.isArray(savedTicket) && savedTicket.length) {
          setTicket(savedTicket);
        }
      } catch { /* no ticket cached */ }

      try {
        await refreshCatalogCache();
        const [fresh, freshCats] = await Promise.all([getCachedProducts(), getCachedCategories()]);
        if (fresh.length) setProducts(fresh as Product[]);
        if (freshCats.length) setCategories(freshCats.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        // offline
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    setMeta(ticketCacheKey, ticket).catch(() => {});
  }, [ticket, ticketCacheKey]);

  // ===== Acciones de ticket =====
  const addProductById = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      toast.error("Producto no encontrado");
      return;
    }
    addProduct(p);
  };

  const addProduct = (p: Product) => {
    setTicket((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = {
          ...copy[i],
          quantity: copy[i].quantity + 1,
          total: (copy[i].quantity + 1) * copy[i].unitPrice,
          addedAt: Date.now(),
        };
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id, name: p.name, unitPrice: Number(p.price),
          quantity: 1, total: Number(p.price), addedAt: Date.now(),
        },
      ];
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

  const removeLine = (productId: string) =>
    setTicket((prev) => prev.filter((l) => l.productId !== productId));

  // ===== Scanner handler =====
  const handleScan = (code: string) => {
    const match = products.find(
      (p) => p.gtin === code || p.sku === code || p.gtin?.replace(/\D/g, "") === code
    );
    if (match) {
      addProduct(match);
      toast.success(`+ ${match.name}`, { duration: 1200 });
    } else {
      toast.error(`Código no reconocido: ${code}`);
    }
  };

  // ===== Hotkeys =====
  usePOSHotkeys({
    onHelp: () => setHelpOpen((v) => !v),
    onPay: () => { if (ticket.length > 0) setPayOpen(true); },
    onSearch: () => searchRef.current?.focus(),
    onCycleMode: () => {
      if (posModes.enabled.length <= 1) return;
      const idx = posModes.enabled.indexOf(saleMode);
      const next = posModes.enabled[(idx + 1) % posModes.enabled.length];
      setSaleMode(next);
      toast.info(`Modo: ${next}`);
    },
    onInvoice: () => { if (lastOrderId) setActionMode("emit"); },
    onQuote: () => { if (ticket.length > 0) setActionMode("quote"); },
    onPark: () => { if (ticket.length > 0) setActionMode("park"); },
    onClear: () => {
      if (ticket.length === 0) return;
      if (confirm("¿Limpiar el ticket actual?")) {
        setTicket([]);
        setMeta(ticketCacheKey, []).catch(() => {});
      }
    },
    onEscape: () => setCloseOpen(true),
  });

  // ===== Derivados =====
  const productsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      if (activeCategory && p.category_id !== activeCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.gtin?.toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCategory]);

  const totals = useMemo(() => {
    const subtotal = ticket.reduce((s, l) => s + l.total, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    return { subtotal, tax, total: subtotal + tax };
  }, [ticket]);

  // ===== Cobro =====
  const handlePaid = async (payments: { method: string; amount: number; reference?: string }[]) => {
    const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
    const change = Math.max(0, amountPaid - totals.total);

    const header = {
      organization_id: organizationId,
      location_id: session.location_id,
      cash_session_id: session.id,
      cashier_id: userId,
      subtotal: totals.subtotal,
      total: totals.total,
      amount_paid: amountPaid,
      change_due: change,
      status: "paid",
      sale_mode: saleMode,
      paid_at: new Date().toISOString(),
    };
    const items = ticket.map((l) => ({
      organization_id: organizationId,
      product_id: l.productId,
      product_name: l.name,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      total: l.total,
    }));
    const paymentRows = payments.map((p) => ({
      organization_id: organizationId,
      cash_session_id: session.id,
      method: p.method,
      amount: p.amount,
      reference: p.reference ?? null,
      received_by: userId,
    }));

    try {
      const clientUuid = await enqueue(
        "pos_order_create",
        { header, items, payments: paymentRows },
        organizationId
      );
      setLastOrderId(clientUuid);
      setTicket([]);
      setMeta(ticketCacheKey, []).catch(() => {});
      setPayOpen(false);

      if (navigator.onLine) {
        toast.success("Ticket cobrado · sincronizando…");
      } else {
        toast.success("Ticket cobrado offline · se enviará al volver la red");
      }

      if (navigator.onLine) {
        setTimeout(() => {
          if (confirm("¿Emitir factura electrónica DIAN para este ticket?")) {
            setActionMode("emit");
          }
        }, 300);
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo encolar el ticket");
    }
  };

  const shiftLabel = `Caja #${session.cash_register_id.slice(0, 4).toUpperCase()}`;
  const dialogOpen = payOpen || closeOpen || helpOpen || cmdOpen || !!actionMode;

  return (
    <div className="h-[100dvh] flex flex-col bg-muted/30 overflow-hidden">
      {/* Scanner global invisible */}
      <POSScannerListener onScan={handleScan} disabled={dialogOpen} />

      {/* TopBar 48px + ModeBar */}
      <POSTopBar
        shiftLabel={shiftLabel}
        cashierName={cashierName}
        openedAt={session.opened_at}
        modes={posModes.enabled}
        activeMode={saleMode}
        onChangeMode={setSaleMode}
        onCloseShift={() => setCloseOpen(true)}
        onOpenShortcuts={() => setHelpOpen(true)}
        rightExtras={
          <>
            <OfflineIndicator />
            {(sync.pending > 0 || sync.syncing) && (
              <button
                onClick={() => sync.flushNow()}
                title={sync.lastError ?? (sync.online ? "Sincronizar pendientes" : "Sin conexión · en cola")}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                  sync.online
                    ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {sync.syncing ? <Loader2 className="h-3 w-3 animate-spin" />
                  : sync.online ? <CloudUpload className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
                <span>{sync.syncing ? "Sync…" : `${sync.pending}`}</span>
              </button>
            )}
          </>
        }
      />

      {/* Tabs de categorías */}
      <POSCategoryTabs
        categories={categories}
        activeId={activeCategory}
        onChange={setActiveCategory}
        counts={productsByCategory}
      />

      {/* Cuerpo: catálogo + ticket */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Catálogo */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-2.5 bg-card border-b flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Buscar producto…  (F3)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => setCmdOpen(true)}
              title="Command Palette (⌘K)"
            >
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd>
              Buscar
            </Button>
            <div className="hidden xl:flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded-md px-2 h-9">
              <ScanLine className="w-3 h-3 text-secondary" />
              <span>Scanner activo</span>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded-md px-2 h-9 hover:border-primary hover:text-primary transition"
              title="Ver todos los atajos (F1)"
            >
              <Keyboard className="w-3 h-3" />
              <kbd className="px-1 bg-muted rounded">F1</kbd>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Cargando catálogo…</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Sin productos en esta vista</p>
            ) : (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
              >
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

        {/* Ticket (sticky card en desktop) */}
        <aside className="lg:w-[360px] bg-card border-t lg:border-t-0 lg:border-l flex flex-col max-h-[55dvh] lg:max-h-none">
          <div className="p-3 border-b flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Ticket actual</h2>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {ticket.length} {ticket.length === 1 ? "ítem" : "ítems"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {ticket.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-muted grid place-items-center mb-2">
                  <ScanLine className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Escanea o toca un producto</p>
                <p className="text-[11px] text-muted-foreground mt-1">⌘K para búsqueda rápida</p>
              </div>
            ) : (
              ticket.map((l) => (
                <div
                  key={l.productId}
                  className="bg-muted/40 rounded-lg p-2 flex items-center gap-2 animate-fade-in"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-tight truncate">{l.name}</p>
                    <p className="text-[11px] text-muted-foreground">{COP(l.unitPrice)} c/u</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(l.productId, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-xs font-bold tabular-nums">{l.quantity}</span>
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(l.productId, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="w-20 text-right">
                    <p className="text-sm font-bold">{COP(l.total)}</p>
                  </div>
                  <button onClick={() => removeLine(l.productId)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t p-3 space-y-2.5 bg-card">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{COP(totals.subtotal)}</span>
              </div>
              {totals.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA {(TAX_RATE * 100).toFixed(0)}%</span>
                  <span className="tabular-nums">{COP(totals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold pt-1 border-t">
                <span>TOTAL</span>
                <span className="text-primary tabular-nums">{COP(totals.total)}</span>
              </div>
            </div>

            <Button
              className="w-full h-14 text-base font-bold shadow-sm"
              disabled={ticket.length === 0}
              onClick={() => setPayOpen(true)}
              style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
            >
              <CreditCard className="w-5 h-5 mr-2" />
              COBRAR
              <kbd className="ml-2 px-1.5 py-0.5 bg-black/15 rounded text-[10px] font-mono">F2</kbd>
            </Button>

            <div className="grid grid-cols-3 gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-[11px]" disabled={!lastOrderId} onClick={() => setActionMode("emit")} title="Facturar último ticket (F6)">
                <FileSignature className="w-3.5 h-3.5 mr-1" /> Facturar
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-[11px]" disabled={ticket.length === 0} onClick={() => setActionMode("quote")} title="Cotizar (F7)">
                <FileText className="w-3.5 h-3.5 mr-1" /> Cotizar
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-[11px]" disabled={ticket.length === 0} onClick={() => setActionMode("park")} title="Suspender (F8)">
                <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
              </Button>
            </div>
          </div>
        </aside>
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

      <POSCommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        products={products}
        onPick={addProductById}
      />

      <POSShortcutsOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
