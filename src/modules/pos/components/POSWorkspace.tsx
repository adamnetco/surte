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
  ScanLine, CreditCard, Percent, StickyNote, ArrowLeftRight, Utensils,
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
import DianHealthIndicator from "./DianHealthIndicator";
import ContingencyBanner from "./ContingencyBanner";
import ResolutionStatusBanner from "./ResolutionStatusBanner";
import EinvoiceShiftWidget from "./EinvoiceShiftWidget";
import { useDianHealth } from "@/modules/pos/hooks/useDianHealth";
import { useEinvoiceResolutionStatus } from "@/modules/pos/hooks/useEinvoiceResolutionStatus";
import OfflineIndicator from "@/modules/offline/components/OfflineIndicator";
import { usePrintQueue, TicketPreviewDialog, type TicketData } from "@/modules/printing";
import {
  refreshCatalogCache, getCachedProducts, getCachedCategories,
} from "@/modules/offline/lib/catalog";
import { setMeta, getMeta } from "@/modules/offline/lib/db";
import { usePOSHotkeys } from "@/modules/pos/hooks/usePOSHotkeys";
import { useRecentProducts } from "@/modules/pos/hooks/useRecentProducts";
import { useRecentActions, type RecentAction } from "@/modules/pos/hooks/useRecentActions";
import { useSyncService } from "@/modules/integrations/sync/useSyncService";
import { enqueue } from "@/modules/offline/lib/outbox";
import { useEinvoiceAutoEmit } from "@/modules/pos/hooks/useEinvoiceAutoEmit";
import POSTopBar from "./POSTopBar";
import POSTopRibbon from "./POSTopRibbon";
import POSQuickCreate from "./POSQuickCreate";
import POSRibbonHotkeysSheet from "./POSRibbonHotkeysSheet";
import POSRightRail from "./POSRightRail";
import POSStatusBar from "./POSStatusBar";
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
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import POSFloorMapPanel from "./POSFloorMapPanel";
import { Utensils as UtensilsIcon, LayoutGrid } from "lucide-react";


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
  const { isAdmin } = useAuth();
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
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [ribbonHelpOpen, setRibbonHelpOpen] = useState(false);
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
  const { shouldEmit: shouldEmitEinvoice } = useEinvoiceAutoEmit(organizationId);
  const dianSnap = useDianHealth(organizationId);
  const resolutionSnap = useEinvoiceResolutionStatus(organizationId);
  const [saleMode, setSaleMode] = useState<PosMode>(posModes.default);

  // === Impresión térmica ===
  // Cola que escucha print_jobs vía Realtime y los ejecuta en este terminal
  // (WebUSB / agente local). Si no hay impresora configurada, queda pasiva.
  usePrintQueue({ organizationId });
  const [lastTicketData, setLastTicketData] = useState<TicketData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const orgInfoRef = useRef({ business_name: "SistecPOS" } as TicketData["org"]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("organizations").select("name, legal_name, nit, address, phone")
        .eq("id", organizationId).maybeSingle();
      if (data) {
        orgInfoRef.current = {
          business_name: data.name ?? "SistecPOS",
          legal_name: data.legal_name ?? null,
          nit: data.nit ?? null,
          address: data.address ?? null,
          phone: data.phone ?? null,
        };
      }
    })();
  }, [organizationId]);

  /**
   * Espera a que outbox materialice la orden (busca por client_uuid)
   * y luego invoca enqueue_print_job para generar recibo + comandas.
   * Si en 6s no aparece (offline real), guarda intención local: al volver
   * la red, una próxima impresión manual desde "Reimprimir" lo cubre.
   */
  const schedulePrint = async (clientUuid: string) => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const { data } = await (supabase as any)
        .from("pos_orders").select("id").eq("client_uuid", clientUuid).maybeSingle();
      if (data?.id) {
        await (supabase as any).rpc("enqueue_print_job", { _order_id: data.id, _kind: "receipt" });
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    // Sin sincronizar: mostrar vista previa como fallback.
    setPreviewOpen(true);
  };

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

  const { recent: recentIds, push: pushRecent } = useRecentProducts(organizationId);
  const { actions: recentActions, push: pushAction, clear: clearRecentActions } = useRecentActions(
    organizationId ? `${organizationId}:${userId}` : null,
  );

  // Handlers re-usables (acciones del rail + replay desde el historial)
  const handlePark = () => {
    if (ticket.length === 0) return;
    setActionMode("park");
    pushAction({ type: "park", label: `Suspender ticket (${ticket.length} ítems)` });
  };
  const handleNotasCredito = () => {
    pushAction({ type: "nc", label: "Notas crédito / Devolución" });
    navigate("/admin/devoluciones");
  };
  const handleVentasDelDia = () => {
    pushAction({ type: "ventas", label: "Ventas del día" });
    navigate("/pos/panel");
  };
  const handleCajon = () => {
    pushAction({ type: "cajon", label: "Abrir cajón monedero" });
    toast.info("Apertura de cajón: configura la impresora de tirilla para enviar el pulso ESC/POS.");
  };
  const handleRefresh = () => {
    pushAction({ type: "refresh", label: "Sincronizar pendientes" });
    sync.flushNow();
  };
  const replayAction = (a: RecentAction) => {
    switch (a.type) {
      case "park": handlePark(); break;
      case "nc": handleNotasCredito(); break;
      case "ventas": handleVentasDelDia(); break;
      case "cajon": handleCajon(); break;
      case "refresh": handleRefresh(); break;
      case "sale_complete":
        toast.info("Última venta completada — abre el panel para reimprimir o emitir factura.");
        break;
    }
  };

  const addProduct = (p: Product) => {
    pushRecent(p.id);
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

  const recentProducts = useMemo(
    () => recentIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [recentIds, products],
  );

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
  const handlePaid = async (
    payments: { method: string; amount: number; reference?: string }[],
    meta: { docType: string | null; tip?: number } = { docType: null, tip: 0 },
  ) => {
    if (payingRef.current) return;
    if (!ticket.length) { toast.error("El ticket está vacío"); return; }
    payingRef.current = true;

    const tipAmount = Math.max(0, Math.round(meta.tip ?? 0));
    const snapshotSubtotal = totals.subtotal;
    const snapshotTotal = totals.total + tipAmount;
    const snapshotItems = ticket;
    const amountPaid = payments.reduce((s, p) => s + p.amount, 0);
    const change = Math.max(0, amountPaid - snapshotTotal);

    const header = {
      organization_id: organizationId,
      location_id: session.location_id,
      cash_session_id: session.id,
      cashier_id: userId,
      subtotal: snapshotSubtotal,
      tip: tipAmount,
      total: snapshotTotal,
      amount_paid: amountPaid,
      change_due: change,
      status: "paid",
      sale_mode: saleMode,
      einvoice_doc_type: meta.docType ?? "pos_electronico",
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
        setSaleComplete({ total: snapshotTotal, amountPaid, change });
        pushAction({ type: "sale_complete", label: `Venta completada · ${COP(snapshotTotal)}`, meta: { orderId: clientUuid } });
      });

      // 3) Snapshot para vista previa local del ticket (siempre disponible
      //    como fallback si no hay impresora configurada o falla el driver).
      setLastTicketData({
        org: orgInfoRef.current,
        ticket_number: undefined,
        cashier_name: cashierName,
        customer_name: null,
        customer_phone: null,
        customer_document: null,
        sale_mode: saleMode,
        created_at: new Date(),
        items: snapshotItems.map((l) => ({
          name: l.name, quantity: l.quantity, unit_price: l.unitPrice, total: l.total,
        })),
        subtotal: snapshotSubtotal, discount: totals.globalDisc, tax: totals.tax, tip: tipAmount,
        total: snapshotTotal, amount_paid: amountPaid, change_due: change,
        payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      });

      // 4) Encolar impresión vía Realtime: recibo cliente + comandas cocina.
      //    Se espera a que outbox materialice la orden (max 6s) y se llama RPC.
      schedulePrint(clientUuid).catch((err) => console.warn("[printing]", err));

      // 5) Soporte fiscal: el recibo POS siempre se imprime (paso 4);
      //    la factura electrónica DIAN (Innapsis) se encola SOLO si la
      //    organización tiene Facturación activa y el cliente cumple el
      //    umbral configurado. Ver useEinvoiceAutoEmit.
      if (shouldEmitEinvoice(snapshotTotal, customer)) {
        // AC11: si DIAN está offline y la org tiene rango de contingencia, pedimos
        // explícitamente modo contingencia. El backend igual auto-detecta (defensa en profundidad).
        const contingencyMode = dianSnap.health === "offline" && dianSnap.hasContingencyRange;
        enqueue(
          "einvoice_emit",
          { client_uuid: clientUuid, document_type: "invoice", contingency_mode: contingencyMode },
          organizationId
        ).catch((err) => console.warn("[einvoice] enqueue failed", err));
      }

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
    <div className="h-[100dvh] flex flex-col bg-muted/30 overflow-hidden md:pr-14">
      {/* Scanner global invisible */}
      <POSScannerListener onScan={handleScan} disabled={dialogOpen} />

      {/* Mini-rail derecho (tablet+) — atajos de alta frecuencia */}
      <POSRightRail
        onCloseShift={() => setCloseOpen(true)}
        onOpenShortcuts={() => setHelpOpen(true)}
        onPark={handlePark}
        onNotasCredito={handleNotasCredito}
        onVentasDelDia={handleVentasDelDia}
        onCajon={handleCajon}
        onRefresh={handleRefresh}
        parkDisabled={ticket.length === 0}
        syncing={sync.syncing}
        pendingCount={sync.pending}
        recentActions={recentActions}
        onReplayAction={replayAction}
        onClearRecent={clearRecentActions}
      />


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
        sync={{
          pending: sync.pending,
          syncing: sync.syncing,
          online: sync.online,
          lastError: sync.lastError,
          onFlush: () => sync.flushNow(),
        }}
        rightExtras={
          <>
            <POSStatusBar
              organizationId={organizationId}
              session={{ opening_amount: session.opening_amount, opened_at: session.opened_at }}
              className="hidden md:flex"
            />
            <OfflineIndicator />
            <DianHealthIndicator organizationId={organizationId} className="hidden md:inline-flex" />
            <EinvoiceShiftWidget organizationId={organizationId} className="hidden lg:inline-flex" />
          </>
        }
      />
      <POSTopRibbon
        onQuickCreate={() => setQuickCreateOpen(true)}
        onShowHotkeys={() => setRibbonHelpOpen(true)}
      />



      {/* AC10/AC11 — Banner DIAN offline / contingencia */}
      <ContingencyBanner
        health={dianSnap.health}
        hasContingencyRange={dianSnap.hasContingencyRange}
      />

      {/* AC14 — Banner pre-cobro si falta/se agota la resolución DIAN */}
      <ResolutionStatusBanner
        snapshot={resolutionSnap}
        einvoiceEnabled={resolutionSnap.status !== "unknown"}
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

          {recentProducts.length > 0 && !loading && (
            <div className="px-3 pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Recientes</p>
                <span className="text-[10px] text-muted-foreground">Tap para añadir</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth">
                {recentProducts.map((p) => (
                  <button
                    key={`recent-${p.id}`}
                    onClick={() => addProduct(p)}
                    className="shrink-0 w-28 bg-card rounded-md border hover:border-primary hover:shadow-sm transition text-left overflow-hidden active:scale-95"
                    title={`+ ${p.name}`}
                  >
                    <div className="aspect-square bg-muted overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">Sin imagen</div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-[11px] font-medium line-clamp-1">{p.name}</p>
                      <p className="text-xs font-bold text-primary">{COP(Number(p.price))}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
        organizationId={organizationId}
        hasCustomerId={!!(customer?.docNumber && customer.docNumber !== "222222222222")}
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

      <POSQuickCreate
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onCreated={(kind, row) => {
          if (kind === "customer") {
            setCustomer({ id: row.id, name: row.name });
          }
        }}
      />
      <POSRibbonHotkeysSheet open={ribbonHelpOpen} onOpenChange={setRibbonHelpOpen} />

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
        onPrint={() => setPreviewOpen(true)}
        onEmitInvoice={() => { setSaleComplete(null); setActionMode("emit"); }}
        posOrderId={lastOrderId ?? null}
        customerEmail={customer?.email ?? null}
        customerPhone={customer?.phone ?? null}
        isAdmin={isAdmin}
      />

      <TicketPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        data={lastTicketData}
        paperMm={80}
        kind="receipt"
      />

    </div>
  );
}
