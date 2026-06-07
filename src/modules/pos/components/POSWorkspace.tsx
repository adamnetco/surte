import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search, FileText, FileSignature, Pause, Keyboard, Printer,
  CloudUpload, CloudOff, Loader2, ScanLine, CreditCard, Percent, StickyNote, ArrowLeftRight, Utensils,
  Bike, ShoppingBag,
} from "lucide-react";
import PaymentDialog from "./PaymentDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CloseSessionDialog from "./CloseSessionDialog";
import InvoiceActionsDialog from "./InvoiceActionsDialog";
import SaleCompleteDialog from "./SaleCompleteDialog";
import OfflineIndicator from "@/modules/offline/components/OfflineIndicator";
import { usePrintQueue, TicketPreviewDialog, type TicketData } from "@/modules/printing";
import {
  refreshCatalogCache, getCachedProducts, getCachedCategories,
} from "@/modules/offline/lib/catalog";
import { setMeta, getMeta } from "@/modules/offline/lib/db";
import { usePOSHotkeys } from "@/modules/pos/hooks/usePOSHotkeys";
import { useSyncService } from "@/modules/integrations/sync/useSyncService";
import { enqueue } from "@/modules/offline/lib/outbox";
import POSTopBar from "./POSTopBar";
import POSCategoryTabs from "./POSCategoryTabs";
import POSCommandPalette from "./POSCommandPalette";
import POSScannerListener from "./POSScannerListener";
import POSShortcutsOverlay from "./POSShortcutsOverlay";
import POSCustomerPicker from "./POSCustomerPicker";
import TableGridSheet from "./TableGridSheet";
import DriverPickerSheet, { type DriverInfo } from "./DriverPickerSheet";
import TicketLineRow, { type TicketLineData } from "./TicketLineRow";
import { usePOSModes } from "@/modules/pos/hooks/usePOSModes";
import { POS_MODES } from "@/modules/pos/lib/posModes";
import { supabase } from "@/integrations/supabase/client";
import type { PosMode } from "@/modules/pos/lib/posModes";
import type { POSCustomer } from "@/modules/pos/lib/posCustomer";


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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [actionMode, setActionMode] = useState<"emit" | "quote" | "park" | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [saleComplete, setSaleComplete] = useState<{ total: number; amountPaid: number; change: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cashierName, setCashierName] = useState("Cajero");
  // Ticket-level extras (presentación; se persisten con setMeta junto al ticket)
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [tableLabel, setTableLabel] = useState(""); // para modo mesa
  const [tableSheetOpen, setTableSheetOpen] = useState(false);
  const [driver, setDriver] = useState<DriverInfo | null>(null); // para modo domicilio
  const [driverSheetOpen, setDriverSheetOpen] = useState(false);
  const [pickupName, setPickupName] = useState(""); // para modo autoservicio (LLEVAR)
  const [ticketNote, setTicketNote] = useState("");
  const [globalDiscPct, setGlobalDiscPct] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
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
        setCatalogError(null);
      } catch (err: any) {
        // offline o falla de red: usamos cache si existe
        if (!products.length) setCatalogError(err?.message || "No se pudo cargar el catálogo");
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
    onTables: () => { if (saleMode === "mesa") setTableSheetOpen(true); },
    onInvoice: () => { if (lastOrderId) setActionMode("emit"); },
    onQuote: () => { if (ticket.length > 0) setActionMode("quote"); },
    onPark: () => { if (ticket.length > 0) setActionMode("park"); },
    onClear: () => {
      if (ticket.length === 0) return;
      setClearConfirmOpen(true);
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
    const lineSubtotal = ticket.reduce((s, l) => {
      const lineDisc = (l.discountPct ?? 0) / 100;
      return s + l.total * (1 - lineDisc);
    }, 0);
    const globalDisc = lineSubtotal * (globalDiscPct / 100);
    const subtotal = Math.max(0, lineSubtotal - globalDisc);
    const tax = Math.round(subtotal * TAX_RATE);
    return { lineSubtotal, globalDisc, subtotal, tax, total: subtotal + tax };
  }, [ticket, globalDiscPct]);

  // ===== Cobro =====
  // Guard contra doble-submit: el await de enqueue + el batch de setState
  // dejaban la puerta abierta a que un Enter/click repetido encolara la venta
  // dos veces (vimos 2 órdenes idénticas en pos_orders).
  const payingRef = useRef(false);
  const handlePaid = async (payments: { method: string; amount: number; reference?: string }[]) => {
    if (payingRef.current) return;
    if (!ticket.length) { toast.error("El ticket está vacío"); return; }
    payingRef.current = true;

    const snapshotTotal = totals.total;
    const snapshotSubtotal = totals.subtotal;
    const snapshotItems = ticket;
    const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
    const change = Math.max(0, amountPaid - snapshotTotal);

    const header = {
      organization_id: organizationId,
      location_id: session.location_id,
      cash_session_id: session.id,
      cashier_id: userId,
      subtotal: snapshotSubtotal,
      total: snapshotTotal,
      amount_paid: amountPaid,
      change_due: change,
      status: "paid",
      sale_mode: saleMode,
      paid_at: new Date().toISOString(),
    };
    const items = snapshotItems.map((l) => ({
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

      // 1) Cerrar PaymentDialog primero y dejar que Radix libere el focus-trap.
      setPayOpen(false);
      // 2) En el siguiente frame, mostrar la confirmación y limpiar el ticket.
      requestAnimationFrame(() => {
        setLastOrderId(clientUuid);
        setTicket([]);
        setMeta(ticketCacheKey, []).catch(() => {});
        setSaleComplete({ total: snapshotTotal, amountPaid, change, items: snapshotItems });
      });

      // 3) Encolar impresión: recibo cliente + comandas de cocina.
      // Se espera a que la orden se materialice (outbox flush) consultando
      // por client_uuid hasta 6s; luego llamamos enqueue_print_job.
      schedulePrint(clientUuid).catch((err) => {
        console.warn("[printing] no se pudo encolar:", err);
      });

      toast.success(
        navigator.onLine
          ? "Ticket cobrado · sincronizando…"
          : "Ticket cobrado offline · se enviará al volver la red"
      );
    } catch (e: any) {
      toast.error(e?.message || "No se pudo encolar el ticket");
    } finally {
      // Liberamos el guard un tick después para evitar el doble Enter.
      setTimeout(() => { payingRef.current = false; }, 400);
    }
  };

  const shiftLabel = `Caja #${session.cash_register_id.slice(0, 4).toUpperCase()}`;
  const dialogOpen = payOpen || closeOpen || helpOpen || cmdOpen || clearConfirmOpen || !!actionMode || !!saleComplete;

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

      {/* Tabs de categorías (60%) + Cliente (40%) */}
      <div className="flex items-stretch border-b bg-card">
        <div className="flex-1 min-w-0 border-r">
          <POSCategoryTabs
            categories={categories}
            activeId={activeCategory}
            onChange={setActiveCategory}
            counts={productsByCategory}
          />
        </div>
        <div className="w-[260px] sm:w-[320px] shrink-0 px-3 py-2 flex items-center">
          <POSCustomerPicker
            customer={customer}
            onChange={setCustomer}
            requireEinvoice={false}
            compact
          />
        </div>
      </div>

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
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
                aria-label="Cargando catálogo"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-lg border overflow-hidden">
                    <Skeleton className="aspect-square rounded-none" />
                    <div className="p-2 space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-4 w-1/2 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : catalogError && filtered.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-2">
                <p className="text-sm font-semibold text-destructive">No se pudo cargar el catálogo</p>
                <p className="text-xs text-muted-foreground">{catalogError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await refreshCatalogCache();
                      const [fresh, freshCats] = await Promise.all([getCachedProducts(), getCachedCategories()]);
                      setProducts(fresh as Product[]);
                      setCategories(freshCats.map((c) => ({ id: c.id, name: c.name })));
                      setCatalogError(null);
                    } catch (e: any) {
                      setCatalogError(e?.message || "Error de red");
                      toast.error("No se pudo refrescar el catálogo");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Reintentar
                </Button>
              </div>
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
        <aside className="lg:w-[380px] bg-card border-t lg:border-t-0 lg:border-l flex flex-col max-h-[55dvh] lg:max-h-none">
          {/* Header con chip de modo + contexto (mesa/cliente) */}
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Ticket actual</h2>
              <span
                className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30"
                title={POS_MODES[saleMode].description}
              >
                {POS_MODES[saleMode].short}
                {saleMode === "mesa" && tableLabel && ` · ${tableLabel}`}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {ticket.length} {ticket.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>

            {/* Contexto rápido por modo */}
            {saleMode === "mesa" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setTableSheetOpen(true)}
                className="w-full h-9 justify-start gap-2 text-xs font-bold"
              >
                <Utensils className="w-4 h-4 text-primary" />
                {tableLabel ? `Mesa ${tableLabel}` : "Seleccionar mesa"}
                <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">F5</kbd>
              </Button>
            )}

            {saleMode === "domicilio" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setDriverSheetOpen(true)}
                className="w-full h-9 justify-start gap-2 text-xs font-bold"
              >
                <Bike className="w-4 h-4 text-primary" />
                {driver ? `Domiciliario: ${driver.name}` : "Seleccionar domiciliario"}
                <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">F6</kbd>
              </Button>
            )}

            {saleMode === "autoservicio" && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-2 h-9 rounded-md border bg-accent/10 text-accent border-accent/30">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="text-xs font-extrabold uppercase tracking-wide">LLEVAR</span>
                </div>
                <Input
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                  placeholder="Recoge el cliente (nombre)"
                  className="h-9 text-xs flex-1"
                />
              </div>
            )}
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
                <TicketLineRow
                  key={l.productId}
                  line={l}
                  onQty={(d) => updateQty(l.productId, d)}
                  onRemove={() => removeLine(l.productId)}
                  onNotes={(notes) =>
                    setTicket((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, notes } : x)))
                  }
                  onDiscount={(pct) =>
                    setTicket((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, discountPct: pct } : x)))
                  }
                />
              ))
            )}
          </div>

          <div className="border-t p-3 space-y-2 bg-card">
            {/* Totales */}
            <div className="space-y-0.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{COP(totals.lineSubtotal)}</span>
              </div>
              {totals.globalDisc > 0 && (
                <div className="flex justify-between text-accent">
                  <span>Descuento {globalDiscPct}%</span>
                  <span className="tabular-nums">-{COP(totals.globalDisc)}</span>
                </div>
              )}
              {totals.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA {(TAX_RATE * 100).toFixed(0)}%</span>
                  <span className="tabular-nums">{COP(totals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-extrabold pt-1 border-t">
                <span>TOTAL</span>
                <span className="text-primary tabular-nums">{COP(totals.total)}</span>
              </div>
            </div>

            {/* Botón principal (cambia label según modo) */}
            <Button
              variant={saleMode === "consumo_interno" ? "cta-primary" : "cta"}
              className="w-full h-14 text-base"
              disabled={ticket.length === 0}
              onClick={() => setPayOpen(true)}
            >
              <CreditCard className="w-5 h-5 mr-2" />
              {saleMode === "consumo_interno" ? "REGISTRAR CORTESÍA" : "COBRAR"}
              <kbd className="ml-2 px-1.5 py-0.5 bg-black/15 rounded text-[10px] font-mono">F2</kbd>
            </Button>

            {/* Acciones secundarias (gastro-friendly) */}
            <div className="grid grid-cols-3 gap-1">
              {/* Cliente vive ahora en la barra superior (POSCustomerPicker) */}

              {/* Descuento global */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 text-[10px] px-1 ${globalDiscPct > 0 ? "border-accent text-accent" : ""}`}
                    title="Descuento al ticket"
                    disabled={ticket.length === 0}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    {globalDiscPct > 0 && <span className="ml-0.5">{globalDiscPct}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-2" side="top">
                  <p className="text-xs font-semibold">Descuento ticket (%)</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 5, 10, 15, 20, 25, 30, 50].map((v) => (
                      <button
                        key={v}
                        onClick={() => setGlobalDiscPct(v)}
                        className={`text-[11px] py-1.5 rounded border ${
                          globalDiscPct === v ? "bg-accent text-accent-foreground border-accent" : "bg-muted hover:bg-accent/20"
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Nota ticket */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 text-[10px] px-1 ${ticketNote ? "border-accent text-accent" : ""}`}
                    title="Nota del ticket"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 space-y-2" side="top">
                  <p className="text-xs font-semibold">Nota del ticket</p>
                  <Textarea
                    value={ticketNote}
                    onChange={(e) => setTicketNote(e.target.value.slice(0, 200))}
                    placeholder="Ej. Pedido para 19h00, entregar en portería…"
                    rows={3}
                    className="text-sm"
                  />
                </PopoverContent>
              </Popover>

              {/* Pausar */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] px-1"
                disabled={ticket.length === 0}
                onClick={() => setActionMode("park")}
                title="Pausar / Suspender (F8)"
              >
                <Pause className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Acciones secundarias fila 2: gastro VectorPOS */}
            <div className="grid grid-cols-3 gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                disabled={ticket.length === 0}
                onClick={() => setActionMode("quote")}
                title="Cotizar (F7)"
              >
                <FileText className="w-3 h-3 mr-1" /> Cotizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                disabled={!lastOrderId}
                onClick={() => setActionMode("emit")}
                title="Facturar último (F6)"
              >
                <FileSignature className="w-3 h-3 mr-1" /> Facturar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                disabled={!lastOrderId}
                onClick={() => window.print()}
                title="Reimprimir última comanda"
              >
                <Printer className="w-3 h-3 mr-1" /> Reimprimir
              </Button>
            </div>

            {/* Específico modo Mesa: Trasladar */}
            {saleMode === "mesa" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px] border-dashed"
                onClick={() => navigate("/mesas")}
                title="Trasladar mesa / productos (gestión completa)"
              >
                <ArrowLeftRight className="w-3 h-3 mr-1" /> Trasladar mesa / productos
              </Button>
            )}
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

      <TableGridSheet
        open={tableSheetOpen}
        onOpenChange={setTableSheetOpen}
        current={tableLabel || null}
        onPick={(t) => setTableLabel(t.label)}
      />

      <DriverPickerSheet
        open={driverSheetOpen}
        onOpenChange={setDriverSheetOpen}
        value={driver}
        onSelect={setDriver}
        organizationId={organizationId}
      />

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar el ticket actual?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {ticket.length} {ticket.length === 1 ? "línea" : "líneas"} del ticket en curso.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTicket([]);
                setMeta(ticketCacheKey, []).catch(() => {});
                setClearConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, limpiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SaleCompleteDialog
        open={!!saleComplete}
        onOpenChange={(v) => { if (!v) setSaleComplete(null); }}
        total={saleComplete?.total ?? 0}
        amountPaid={saleComplete?.amountPaid ?? 0}
        change={saleComplete?.change ?? 0}
        canEmitInvoice={!!lastOrderId && navigator.onLine}
        onNewSale={() => setSaleComplete(null)}
        onPrint={() => { window.print(); }}
        onEmitInvoice={() => { setSaleComplete(null); setActionMode("emit"); }}
      />

    </div>
  );
}
