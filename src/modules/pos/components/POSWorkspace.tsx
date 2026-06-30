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
  Bike, ShoppingBag, ChevronUp, ChevronDown,
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

import { usePrintQueue, TicketPreviewDialog, type TicketData } from "@/modules/printing";
import {
  refreshCatalogCache, getCachedProducts, getCachedCategories,
} from "@/modules/offline/lib/catalog";
import { setMeta, getMeta } from "@/modules/offline/lib/db";
import { usePOSHotkeys } from "@/modules/pos/hooks/usePOSHotkeys";
import { usePriceListOverrides } from "@/modules/pos/hooks/usePriceListOverrides";
import { useRecentProducts } from "@/modules/pos/hooks/useRecentProducts";
import { useRecentActions, type RecentAction } from "@/modules/pos/hooks/useRecentActions";
import { useSyncService } from "@/modules/integrations/sync/useSyncService";
import { enqueue } from "@/modules/offline/lib/outbox";
import { useEinvoiceAutoEmit } from "@/modules/pos/hooks/useEinvoiceAutoEmit";
import POSTopBar from "./POSTopBar";
import POSTopRibbon from "./POSTopRibbon";
import POSQuickCreate from "./POSQuickCreate";
import POSRibbonHotkeysSheet from "./POSRibbonHotkeysSheet";
import RecentActionsPopover from "./RecentActionsPopover";
import { Receipt, BarChart3, Wallet, RefreshCw, CloudUpload, CloudOff, Loader2 } from "lucide-react";
import POSActionRail from "./POSActionRail";
import POSStatusBar from "./POSStatusBar";
import POSCategoryTabs from "./POSCategoryTabs";
import POSCommandPalette from "./POSCommandPalette";
import POSScannerListener from "./POSScannerListener";
import POSShortcutsOverlay from "./POSShortcutsOverlay";
import POSCustomerPicker from "./POSCustomerPicker";
// POSContextualBar removed: Suspendidas se promovió al health strip; el selector
// global de "Precios" se elimina (los precios derivan del cliente / lista por SKU).

import TableGridSheet from "./TableGridSheet";
import POSQuickModifiersSheet from "./POSQuickModifiersSheet";
import POSModifiersPickerSheet from "./POSModifiersPickerSheet";
import { useProductsWithModifiers } from "@/modules/pos/hooks/useProductsWithModifiers";
import DriverPickerSheet, { type DriverInfo } from "./DriverPickerSheet";
import TicketLineRow, { type TicketLineData } from "./TicketLineRow";
import { usePOSModes } from "@/modules/pos/hooks/usePOSModes";
import { POS_MODES } from "@/modules/pos/lib/posModes";
import { supabase } from "@/integrations/supabase/client";
import type { PosMode } from "@/modules/pos/lib/posModes";
import type { POSCustomer } from "@/modules/pos/lib/posCustomer";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import POSFloorMapPanel from "./POSFloorMapPanel";
import { Utensils as UtensilsIcon, LayoutGrid } from "lucide-react";


interface Product {
  id: string; name: string; price: number;
  image_url: string | null; stock: number;
  category_id?: string | null; sku?: string | null; gtin?: string | null;
}
interface Category { id: string; name: string; icon_name?: string | null; }
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
  const [searchHighlight, setSearchHighlight] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [ticket, setTicket] = useState<TicketLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
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
  const { currentOrg, hasModule } = useOrganization();
  const isFood = (currentOrg?.business_type ?? "") === "food" && hasModule("dining_tables");
  const [catalogView, setCatalogView] = useState<"catalog" | "tables">(isFood ? "tables" : "catalog");
  useEffect(() => { setCatalogView(isFood ? "tables" : "catalog"); }, [isFood]);
  const [cashierName, setCashierName] = useState("Cajero");
  // Ticket-level extras (presentación; se persisten con setMeta junto al ticket)
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [tableLabel, setTableLabel] = useState(""); // para modo mesa
  const [tableSheetOpen, setTableSheetOpen] = useState(false);
  const [quickModsOpen, setQuickModsOpen] = useState(false);
  const [stickyNotes, setStickyNotes] = useState<string[]>([]);
  const [modPickerProduct, setModPickerProduct] = useState<Product | null>(null);
  const productsWithMods = useProductsWithModifiers(organizationId);
  const [driver, setDriver] = useState<DriverInfo | null>(null); // para modo domicilio
  const [driverSheetOpen, setDriverSheetOpen] = useState(false);
  const [pickupName, setPickupName] = useState(""); // para modo autoservicio (LLEVAR)
  const [ticketNote, setTicketNote] = useState("");
  const [globalDiscPct, setGlobalDiscPct] = useState(0);
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const [, setPriceListName] = useState<string>("Pública");
  const [parkedCount, setParkedCount] = useState(0);
  // Mobile: ticket colapsado por defecto para maximizar catálogo. Totales/Cobrar siempre visibles.
  const [mobileTicketExpanded, setMobileTicketExpanded] = useState(false);
  const isMobile = useIsMobile();
  // === Cobro de mesa ===
  // Cuando el usuario pulsa "Cobrar" en TableOrderDrawer, el ticket de mesa se
  // carga aquí y guardamos el contexto para liberar la mesa al finalizar la venta.
  const [activeTableOrder, setActiveTableOrder] = useState<{
    tableOrderId: string; tableId: string; tableLabel: string; releaseTableOnPaid: boolean;
  } | null>(null);
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

  // Conteo de tickets suspendidos (refrescado en cambio de session/org)
  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const { count } = await (supabase as any)
        .from("parked_tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (!cancel) setParkedCount(count ?? 0);
    };
    load();
    const ch = (supabase as any)
      .channel(`parked-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parked_tickets", filter: `organization_id=eq.${organizationId}` },
        load
      )
      .subscribe();
    return () => {
      cancel = true;
      (supabase as any).removeChannel(ch);
    };
  }, [organizationId]);

  // Listener: cargar items de una mesa al pulsar "Cobrar" en TableOrderDrawer.
  // Reemplaza el ticket actual (avisando si tiene contenido) y cambia a vista catálogo.
  useEffect(() => {
    const onBill = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        tableOrderId: string; tableId: string; tableLabel: string; releaseTableOnPaid: boolean;
        items: Array<{ productId: string | null; name: string; quantity: number; unitPrice: number; total: number; notes?: string }>;
      };
      if (!detail?.items?.length) return;
      if (ticket.length > 0 && !confirm("Hay un ticket activo. ¿Reemplazarlo con la cuenta de la mesa?")) return;
      const now = Date.now();
      const lines: TicketLine[] = detail.items.map((it, i) => ({
        productId: it.productId ?? `table:${detail.tableOrderId}:${i}`,
        name: it.name,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        total: it.total,
        addedAt: now + i,
        ...(it.notes ? { notes: it.notes } : {}),
      }));
      setTicket(lines);
      setTableLabel(detail.tableLabel);
      setActiveTableOrder({
        tableOrderId: detail.tableOrderId,
        tableId: detail.tableId,
        tableLabel: detail.tableLabel,
        releaseTableOnPaid: detail.releaseTableOnPaid,
      });
      setCatalogView("catalog");
      toast.info(`Mesa ${detail.tableLabel} lista para cobrar`);
    };
    window.addEventListener("pos:bill-table-order", onBill as EventListener);
    return () => window.removeEventListener("pos:bill-table-order", onBill as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.length]);



  const ticketCacheKey = `pos_ticket:${session.id}`;

  // Hydrate catalog + persisted ticket
  useEffect(() => {
    (async () => {
      let cachedCatsLen = 0;
      try {
        const [cached, cats] = await Promise.all([getCachedProducts(), getCachedCategories()]);
        if (cached.length) {
          setProducts(cached as Product[]);
          setLoading(false);
        }
        cachedCatsLen = cats.length;
        if (cats.length) setCategories(cats.map((c: any) => ({ id: c.id, name: c.name, icon_name: c.icon_name ?? null })));
      } catch { /* no cache */ }

      try {
        const savedTicket = await getMeta<TicketLine[]>(ticketCacheKey);
        if (savedTicket && Array.isArray(savedTicket) && savedTicket.length) {
          setTicket(savedTicket);
        }
      } catch { /* no ticket cached */ }

      try {
        // Si no había categorías cacheadas, forzamos refresh para evitar quedar
        // pegados con un cache antiguo previo al fix de columna `icon`.
        await refreshCatalogCache(cachedCatsLen === 0);
        const [fresh, freshCats] = await Promise.all([getCachedProducts(), getCachedCategories()]);
        if (fresh.length) setProducts(fresh as Product[]);
        if (freshCats.length) setCategories(freshCats.map((c: any) => ({ id: c.id, name: c.name, icon_name: c.icon_name ?? null })));

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

  const { priceFor, hasOverrides, overrideCount } = usePriceListOverrides(organizationId, priceListId);

  // Al cambiar de lista, re-priceamos las líneas existentes para reflejar el contexto
  // (sin tocar cantidades ni notas — sólo unitPrice y total).
  useEffect(() => {
    setTicket((prev) =>
      prev.map((l) => {
        const np = priceFor(l.productId, l.unitPrice);
        if (np === l.unitPrice) return l;
        return { ...l, unitPrice: np, total: l.quantity * np };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceListId]);

  const pushLine = (p: Product, unitPriceOverride?: number, extraNotes?: string) => {
    pushRecent(p.id);
    const unit = unitPriceOverride ?? priceFor(p.id, Number(p.price));
    const sticky = stickyNotes.length > 0 ? stickyNotes.join(" · ") : "";
    const notes = [extraNotes, sticky].filter(Boolean).join(" · ");
    setTicket((prev) => {
      // Si lleva modificadores o notas, NUNCA agrupar (cada línea es única).
      const i = !notes
        ? prev.findIndex((l) => l.productId === p.id && !l.notes)
        : -1;
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
          productId: p.id, name: p.name, unitPrice: unit,
          quantity: 1, total: unit, addedAt: Date.now(),
          ...(notes ? { notes } : {}),
        },
      ];
    });
    if (sticky) setStickyNotes([]);
    // Feedback móvil: vibración háptica + toast con acción a expandir ticket.
    if (isMobile) {
      try { navigator.vibrate?.(8); } catch { /* noop */ }
      if (!mobileTicketExpanded) {
        toast.success(`+ ${p.name}`, {
          duration: 1400,
          action: { label: "Ver ticket", onClick: () => setMobileTicketExpanded(true) },
        });
      }
    }
  };


  const addProduct = (p: Product) => {
    // Slice 3-food: si el producto tiene modifier_groups, abrir picker antes de añadir.
    if (isFood && productsWithMods.has(p.id)) {
      setModPickerProduct(p);
      return;
    }
    pushLine(p);
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

  const removeLine = (productId: string) => {
    setTicket((prev) => prev.filter((l) => l.productId !== productId));
    setSelectedLineId((cur) => (cur === productId ? null : cur));
  };

  const setLineQty = (productId: string, qty: number) =>
    setTicket((prev) =>
      prev.flatMap((l) => {
        if (l.productId !== productId) return [l];
        if (qty <= 0) return [];
        return [{ ...l, quantity: qty, total: qty * l.unitPrice }];
      })
    );
  const setLineNotes = (productId: string, notes: string) =>
    setTicket((prev) => prev.map((x) => (x.productId === productId ? { ...x, notes } : x)));
  const setLineDiscount = (productId: string, pct: number) =>
    setTicket((prev) =>
      prev.map((x) => (x.productId === productId ? { ...x, discountPct: Math.max(0, Math.min(100, pct)) } : x))
    );

  // === Acciones del Action Rail (línea seleccionada) ===
  const selectedLine = useMemo(
    () => ticket.find((l) => l.productId === selectedLineId) ?? null,
    [ticket, selectedLineId],
  );
  const railMultiply = () => {
    if (!selectedLine) return;
    const raw = window.prompt(`Cantidad para "${selectedLine.name}"`, String(selectedLine.quantity));
    if (raw == null) return;
    const n = Math.max(0, Math.floor(Number(raw.replace(",", ".")) || 0));
    setLineQty(selectedLine.productId, n);
  };
  const railCut = () => selectedLine && updateQty(selectedLine.productId, -1);
  const railComment = () => {
    if (!selectedLine) return;
    const raw = window.prompt(`Nota para "${selectedLine.name}"`, selectedLine.notes ?? "");
    if (raw == null) return;
    setLineNotes(selectedLine.productId, raw.slice(0, 140).trim());
  };
  const railDiscount = () => {
    if (!selectedLine) return;
    const raw = window.prompt(`Descuento % para "${selectedLine.name}" (0-100)`, String(selectedLine.discountPct ?? 0));
    if (raw == null) return;
    setLineDiscount(selectedLine.productId, Number(raw.replace(",", ".")) || 0);
  };
  const railDelete = () => {
    if (!selectedLine) return;
    if (window.confirm(`¿Eliminar "${selectedLine.name}" del ticket?`)) removeLine(selectedLine.productId);
  };

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

  const categoryNameById = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

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

  // Sugerencias de autocompletado mientras se escribe (máx 8). Si hay query
  // ignoramos el filtro de categoría activa para que el cajero encuentre
  // siempre por nombre/SKU/código de barras.
  const searchSuggestions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [] as Product[];
    return products
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.gtin?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, search]);

  useEffect(() => { setSearchHighlight(0); }, [search]);

  // ===== Atajos numéricos Alt+1..9 (estilo VectorPOS) =====
  // Añade al ticket el N-ésimo producto visible del grid. Solo activo cuando
  // el operador está en la vista catálogo y no está tecleando.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (catalogView !== "catalog") return;
      const n = parseInt(e.key, 10);
      if (!Number.isFinite(n) || n < 1 || n > 9) return;
      const p = filtered[n - 1];
      if (!p) return;
      e.preventDefault();
      addProduct(p);
      toast.success(`+ ${p.name}`, { duration: 900 });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, catalogView]);

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

      // 2.b) Si la venta provino de una mesa, marcar table_order como pagada
      //      y, si era la última sub-cuenta, liberar la mesa.
      if (activeTableOrder) {
        const ato = activeTableOrder;
        (async () => {
          try {
            await (supabase as any)
              .from("table_orders")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("organization_id", organizationId).eq("id", ato.tableOrderId);
            if (ato.releaseTableOnPaid) {
              await (supabase as any)
                .from("dining_tables")
                .update({ status: "available" })
                .eq("organization_id", organizationId).eq("id", ato.tableId);
            }
          } catch (err) {
            console.warn("[table-order paid]", err);
          }
        })();
        setActiveTableOrder(null);
        setTableLabel("");
      }



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
    <div className="h-[100dvh] flex flex-col bg-muted/30 overflow-hidden">
      {/* Scanner global invisible */}
      <POSScannerListener onScan={handleScan} disabled={dialogOpen} />

      {/* NOTE: POSRightRail eliminado — sus acciones (NC, Ventas día, Cajón,
          Recientes, Cierre Z) viven ahora en el Sheet "Sesión POS" del TopBar
          (botón Settings). Sync con badge ámbar sigue inline en el TopBar.
          Suspender (F8) y Atajos (?) están en POSTopRibbon / hotkeys.
          Ver `.lovable/memory/features/pos-right-rail-removed.md`. */}


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
        
        extraActions={
          <>
            <Button variant="outline" className="w-full justify-start" onClick={handleNotasCredito}>
              <Receipt className="w-4 h-4 mr-2" /> Notas crédito / Devolución
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleVentasDelDia}>
              <BarChart3 className="w-4 h-4 mr-2" /> Ventas del día
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleCajon}>
              <Wallet className="w-4 h-4 mr-2" /> Abrir cajón monedero
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleRefresh}
              disabled={sync.syncing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${sync.syncing ? "animate-spin" : ""}`} />
              {sync.pending > 0 ? `Sincronizar (${sync.pending})` : "Refrescar sync"}
            </Button>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-xs text-muted-foreground">Acciones recientes</span>
              <RecentActionsPopover
                actions={recentActions}
                onReplay={replayAction}
                onClear={clearRecentActions}
              />
            </div>
          </>
        }
      />
      <POSTopRibbon
        onQuickCreate={() => setQuickCreateOpen(true)}
        onShowHotkeys={() => setRibbonHelpOpen(true)}
        modes={posModes.enabled}
        activeMode={saleMode}
        onChangeMode={setSaleMode}
      />


      {/* Health strip — relocated out of POSTopBar's right cluster to prevent
          flex-wrap overflow that broke the topbar layout on <1280px viewports.
          Sticky under the ribbon, single scrollable row, hidden on mobile to
          keep the catalog above the fold. Pills/widgets render inline-nowrap
          with horizontal scroll fallback. */}
      <div
        role="region"
        aria-label="Estado del sistema y facturación"
        className="hidden md:flex sticky top-[104px] z-10 bg-card/95 backdrop-blur border-b px-3 py-1.5 items-center gap-2 overflow-x-auto scrollbar-none"
      >
        <POSStatusBar
          organizationId={organizationId}
          session={{ opening_amount: session.opening_amount, opened_at: session.opened_at }}
        />
        <DianHealthIndicator organizationId={organizationId} className="shrink-0" />
        <EinvoiceShiftWidget organizationId={organizationId} className="hidden lg:inline-flex shrink-0" />
        <div className="flex-1" />
        {(sync.pending > 0 || sync.syncing) && (
          <button
            type="button"
            onClick={() => sync.flushNow()}
            title={sync.lastError ?? (sync.online ? "Sincronizar pendientes" : "Sin conexión · en cola")}
            aria-label={sync.syncing ? "Sincronizando" : `${sync.pending} pendientes por sincronizar`}
            className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-amber-50 border-amber-300 hover:bg-amber-100 text-xs font-semibold text-amber-900 transition"
          >
            {sync.syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : sync.online ? (
              <CloudUpload className="w-3.5 h-3.5" />
            ) : (
              <CloudOff className="w-3.5 h-3.5" />
            )}
            {sync.syncing ? "Sincronizando" : `${sync.pending} pendiente${sync.pending === 1 ? "" : "s"}`}
          </button>
        )}
        {parkedCount > 0 && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("pos:open-parked"))}
            className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-amber-50 border-amber-300 hover:bg-amber-100 text-xs font-semibold text-amber-900 transition"
            title="Tickets suspendidos (F8 para suspender)"
            aria-label={`${parkedCount} ticket(s) suspendido(s)`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Suspendidas
            <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {parkedCount}
            </span>
          </button>
        )}
      </div>

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
        <div className="w-[160px] sm:w-[200px] shrink-0 px-2 py-2 flex items-center">
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
          {isFood && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-card border-b">
              <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCatalogView("tables")}
                  className={`h-7 px-3 rounded-sm inline-flex items-center gap-1.5 transition ${
                    catalogView === "tables" ? "bg-card shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UtensilsIcon className="w-3.5 h-3.5" /> Mesas
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogView("catalog")}
                  className={`h-7 px-3 rounded-sm inline-flex items-center gap-1.5 transition ${
                    catalogView === "catalog" ? "bg-card shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Catálogo
                </button>
              </div>
              <span className="text-[10px] text-muted-foreground ml-2 hidden md:inline">
                {catalogView === "tables" ? "Selecciona una mesa para abrir su cuenta" : "Venta directa de mostrador"}
              </span>
            </div>
          )}

          {isFood && catalogView === "tables" ? (
            <POSFloorMapPanel organizationId={organizationId} userId={userId} />
          ) : (
          <>
          <div className="p-2.5 bg-card border-b flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                placeholder="Buscar producto…  (F3)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
                onKeyDown={(e) => {
                  if (searchSuggestions.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSearchHighlight((i) => Math.min(i + 1, searchSuggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSearchHighlight((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const pick = searchSuggestions[searchHighlight] ?? searchSuggestions[0];
                    if (pick) {
                      addProduct(pick);
                      setSearch("");
                    }
                  } else if (e.key === "Escape") {
                    if (search) { e.preventDefault(); setSearch(""); }
                  }
                }}
                aria-autocomplete="list"
                aria-expanded={searchFocused && searchSuggestions.length > 0}
                aria-activedescendant={
                  searchFocused && searchSuggestions[searchHighlight]
                    ? `pos-suggestion-${searchSuggestions[searchHighlight].id}`
                    : undefined
                }
                className="pl-9 h-9"
              />
              {searchFocused && searchSuggestions.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute z-30 left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden max-h-80 overflow-y-auto"
                >
                  {searchSuggestions.map((p, i) => {
                    const cat = p.category_id ? categoryNameById[p.category_id] : null;
                    const active = i === searchHighlight;
                    return (
                      <li
                        id={`pos-suggestion-${p.id}`}
                        key={p.id}
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setSearchHighlight(i)}
                        onMouseDown={(e) => {
                          // mousedown para que dispare antes del blur
                          e.preventDefault();
                          addProduct(p);
                          setSearch("");
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs ${
                          active ? "bg-primary/10 text-foreground" : "hover:bg-muted/60"
                        }`}
                      >
                        <span className="flex-1 truncate font-medium">{p.name}</span>
                        {cat && (
                          <span className="text-[10px] text-muted-foreground shrink-0">({cat})</span>
                        )}
                        <span className="font-bold text-primary tabular-nums shrink-0">{COP(Number(p.price))}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                      setCategories(freshCats.map((c: any) => ({ id: c.id, name: c.name, icon_name: c.icon_name ?? null })));
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
                style={{ gridTemplateColumns: isFood
                  ? "repeat(auto-fill, minmax(120px, 1fr))"
                  : "repeat(auto-fill, minmax(140px, 1fr))" }}
              >
                {filtered.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="relative bg-card rounded-lg border hover:border-primary hover:shadow-sm transition text-left overflow-hidden active:scale-95"
                  >
                    {!isFood && idx < 9 && (
                      <kbd
                        className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 text-[10px] font-bold rounded bg-foreground/85 text-background shadow-sm"
                        title={`Alt+${idx + 1} para añadir`}
                        aria-hidden="true"
                      >
                        Alt+{idx + 1}
                      </kbd>
                    )}
                    <div className="aspect-square bg-muted overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">Sin imagen</div>
                      )}
                    </div>
                    <div className={isFood ? "p-2" : "p-2.5"}>
                      <p className={isFood ? "text-xs font-medium line-clamp-2 min-h-[2rem]" : "text-sm font-semibold line-clamp-2 min-h-[2.5rem]"}>{p.name}</p>
                      <p className={isFood ? "text-sm font-bold text-primary mt-1" : "text-base font-bold text-primary mt-1"}>{COP(Number(p.price))}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Ticket (sticky card en desktop; en móvil colapsable con footer fijo) */}
        <aside
          className={`bg-card border-t lg:border-t-0 lg:border-l flex flex-col lg:w-[380px] lg:max-h-none ${
            mobileTicketExpanded ? "max-h-[70dvh]" : "max-h-none"
          }`}
        >
          {/* Grabber táctil: swipe-down para colapsar, tap para alternar */}
          <button
            type="button"
            onClick={() => setMobileTicketExpanded((v) => !v)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              (e.currentTarget as any)._sy = t.clientY;
            }}
            onTouchEnd={(e) => {
              const sy = (e.currentTarget as any)._sy as number | undefined;
              const t = e.changedTouches[0];
              if (sy == null) return;
              const dy = t.clientY - sy;
              if (mobileTicketExpanded && dy > 40) {
                setMobileTicketExpanded(false);
                try { navigator.vibrate?.(6); } catch { /* noop */ }
              } else if (!mobileTicketExpanded && dy < -40) {
                setMobileTicketExpanded(true);
                try { navigator.vibrate?.(6); } catch { /* noop */ }
              }
            }}
            aria-label={mobileTicketExpanded ? "Colapsar ticket (desliza hacia abajo)" : "Expandir ticket (desliza hacia arriba)"}
            className="lg:hidden w-full py-2 flex items-center justify-center group touch-pan-y"
          >
            <span className={`block h-1.5 w-12 rounded-full transition-colors ${
              !mobileTicketExpanded && ticket.length > 0
                ? "bg-primary/60 group-hover:bg-primary"
                : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
            }`} />
          </button>

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
              <button
                type="button"
                onClick={() => setMobileTicketExpanded((v) => !v)}
                className={`ml-auto lg:hidden inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border transition ${
                  !mobileTicketExpanded && ticket.length > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                aria-expanded={mobileTicketExpanded}
                aria-label={mobileTicketExpanded ? "Colapsar ticket" : "Ver ítems del ticket"}
              >
                <span className="tabular-nums">{ticket.length}</span>
                <span className="hidden xs:inline">{ticket.length === 1 ? "ítem" : "ítems"}</span>
                {mobileTicketExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <span className="hidden lg:inline ml-auto text-[11px] text-muted-foreground">
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



          <div className={`${mobileTicketExpanded ? "flex" : "hidden"} lg:flex flex-col flex-1 min-h-0`}>
            <POSActionRail
              hasSelection={!!selectedLine}
              onMultiply={railMultiply}
              onCut={railCut}
              onComment={railComment}
              onDiscount={railDiscount}
              onDelete={railDelete}
            />

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
                    selected={selectedLineId === l.productId}
                    onSelect={() => setSelectedLineId(l.productId)}
                    onQty={(d) => updateQty(l.productId, d)}
                    onRemove={() => removeLine(l.productId)}
                    onNotes={(notes) => setLineNotes(l.productId, notes)}
                    onDiscount={(pct) => setLineDiscount(l.productId, pct)}
                  />
                ))
              )}
            </div>
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

            {/* "Trasladar mesa / productos" eliminado: la transferencia vive en
                TableOrderDrawer (split + ArrowRightLeft) y el switch de vista
                Mesas/Catálogo + F5 ya cubre la navegación a la grilla. */}
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
        onPick={(t) => {
          const prev = tableLabel;
          setTableLabel(t.label);
          // Slice 2-food: al ABRIR mesa por primera vez en food, ofrecer
          // modificadores rápidos que se pegan al próximo ítem añadido.
          if (isFood && t.label && t.label !== prev) {
            setQuickModsOpen(true);
          }
        }}
      />

      <POSQuickModifiersSheet
        open={quickModsOpen}
        onOpenChange={setQuickModsOpen}
        organizationId={organizationId}
        tableLabel={tableLabel || null}
        onApply={(notes) => setStickyNotes(notes)}
      />

      <POSModifiersPickerSheet
        open={!!modPickerProduct}
        onOpenChange={(o) => { if (!o) setModPickerProduct(null); }}
        product={modPickerProduct}
        onConfirm={(adj, summary) => {
          if (!modPickerProduct) return;
          const base = priceFor(modPickerProduct.id, Number(modPickerProduct.price));
          pushLine(modPickerProduct, base + adj, summary);
          setModPickerProduct(null);
        }}
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
