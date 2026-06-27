import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardList, Search, Trash2, Loader2, Plus, Check, AlertTriangle, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  orgId: string;
  warehouseId: string;
  warehouseName?: string;
  onApplied?: () => void;
};

type Candidate = {
  product_id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  expected: number;
};

type CountEntry = Candidate & { counted: string };

const storageKey = (orgId: string, warehouseId: string) => `pos:count:${orgId}:${warehouseId}`;

export default function ConteoFisicoSheet({ open, onClose, orgId, warehouseId, warehouseName, onApplied }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [entries, setEntries] = useState<CountEntry[]>([]);
  const [applying, setApplying] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // hydrate session from localStorage
  useEffect(() => {
    if (!open || !orgId || !warehouseId) return;
    try {
      const raw = localStorage.getItem(storageKey(orgId, warehouseId));
      setEntries(raw ? JSON.parse(raw) : []);
    } catch { setEntries([]); }
  }, [open, orgId, warehouseId]);

  // persist
  useEffect(() => {
    if (!open || !orgId || !warehouseId) return;
    try {
      if (entries.length === 0) localStorage.removeItem(storageKey(orgId, warehouseId));
      else localStorage.setItem(storageKey(orgId, warehouseId), JSON.stringify(entries));
    } catch {}
  }, [entries, open, orgId, warehouseId]);

  // search products in warehouse
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = search.trim();
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      const { data: stockData } = await supabase
        .from("product_stock")
        .select("product_id, quantity, products!inner(id, name, sku, image_url, organization_id)")
        .eq("organization_id", orgId)
        .eq("warehouse_id", warehouseId)
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`, { foreignTable: "products" })
        .limit(15);
      const list: Candidate[] = (stockData ?? []).map((s: any) => ({
        product_id: s.product_id,
        name: s.products?.name ?? "—",
        sku: s.products?.sku ?? null,
        image_url: s.products?.image_url ?? null,
        expected: Number(s.quantity ?? 0),
      }));
      setResults(list);
      setSearching(false);
    }, 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [search, open, orgId, warehouseId]);

  const addEntry = (c: Candidate) => {
    setEntries((prev) => {
      if (prev.some((e) => e.product_id === c.product_id)) {
        toast.info("Ya está en la lista");
        return prev;
      }
      return [{ ...c, counted: "" }, ...prev];
    });
    setSearch("");
    setResults([]);
  };

  const updateCounted = (productId: string, counted: string) => {
    setEntries((prev) => prev.map((e) => (e.product_id === productId ? { ...e, counted } : e)));
  };

  const removeEntry = (productId: string) => {
    setEntries((prev) => prev.filter((e) => e.product_id !== productId));
  };

  const summary = useMemo(() => {
    let positives = 0, negatives = 0, zero = 0, ready = 0;
    for (const e of entries) {
      if (e.counted === "" || isNaN(Number(e.counted))) continue;
      ready++;
      const delta = Number(e.counted) - e.expected;
      if (delta > 0) positives++;
      else if (delta < 0) negatives++;
      else zero++;
    }
    return { positives, negatives, zero, ready, total: entries.length };
  }, [entries]);

  const applyAll = async () => {
    const valid = entries.filter((e) => e.counted !== "" && !isNaN(Number(e.counted)));
    if (valid.length === 0) { toast.error("Sin conteos válidos"); return; }
    setApplying(true);
    let ok = 0, fail = 0;
    for (const e of valid) {
      const delta = Number(e.counted) - e.expected;
      if (delta === 0) { ok++; continue; }
      const movementType = delta > 0 ? "in" : "out";
      const { error } = await supabase.rpc("apply_stock_movement", {
        _org_id: orgId,
        _warehouse_id: warehouseId,
        _product_id: e.product_id,
        _presentation_id: null,
        _movement_type: movementType,
        _quantity: Math.abs(delta),
        _unit_cost: 0,
        _reference_type: "physical_count",
        _reference_id: null,
        _notes: `Conteo físico: esperado ${e.expected}, contado ${e.counted}`,
      });
      if (error) fail++; else ok++;
    }
    setApplying(false);
    if (fail === 0) {
      toast.success(`Conteo aplicado: ${ok} ajuste(s)`);
      setEntries([]);
      onApplied?.();
      onClose();
    } else {
      toast.warning(`Aplicados ${ok}, fallaron ${fail}`);
      onApplied?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 text-base font-heading">
            <ClipboardList size={18} className="text-primary" />
            Conteo físico
          </SheetTitle>
          <SheetDescription className="text-xs">
            {warehouseName ?? "Bodega"} · Captura cantidades reales y aplica todos los ajustes en lote.
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border bg-card relative">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o SKU para agregar..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border text-sm"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute left-4 right-4 mt-1 z-10 bg-popover border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.product_id}
                  onClick={() => addEntry(r)}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 border-b border-border last:border-0"
                >
                  <img src={r.image_url || "/placeholder.svg"} alt="" className="w-8 h-8 rounded object-cover bg-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">SKU: {r.sku || "—"} · Sistema: {r.expected}</p>
                  </div>
                  <Plus size={14} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
          {searching && search.length >= 2 && results.length === 0 && (
            <p className="absolute left-4 mt-2 text-[10px] text-muted-foreground">Buscando…</p>
          )}
        </div>

        {/* Summary */}
        {entries.length > 0 && (
          <div className="px-4 py-2 border-b border-border bg-card grid grid-cols-4 gap-2 text-center">
            <Stat label="En lista" value={summary.total} tone="default" />
            <Stat label="Listos" value={summary.ready} tone="primary" />
            <Stat label="Faltantes" value={summary.negatives} tone="destructive" />
            <Stat label="Sobrantes" value={summary.positives} tone="success" />
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 && !searching && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
              Busca productos arriba y captura su cantidad real. El borrador se guarda automáticamente.
            </div>
          )}
          {entries.map((e) => {
            const num = Number(e.counted);
            const valid = e.counted !== "" && !isNaN(num);
            const delta = valid ? num - e.expected : null;
            return (
              <div key={e.product_id} className="bg-card border border-border rounded-xl p-3 flex gap-3 items-center">
                <img src={e.image_url || "/placeholder.svg"} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.name}</p>
                  <p className="text-[11px] text-muted-foreground">SKU: {e.sku || "—"} · Sistema: <strong>{e.expected}</strong></p>
                  {delta !== null && delta !== 0 && (
                    <p className={`text-[11px] font-semibold mt-0.5 ${delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                      Diferencia: {delta > 0 ? "+" : ""}{delta}
                    </p>
                  )}
                  {delta === 0 && valid && (
                    <p className="text-[11px] font-semibold mt-0.5 text-muted-foreground inline-flex items-center gap-1">
                      <Check size={11} /> Coincide
                    </p>
                  )}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={e.counted}
                  onChange={(ev) => updateCounted(e.product_id, ev.target.value)}
                  placeholder="0"
                  className="w-20 px-2 py-2 rounded-lg bg-background border border-border text-sm text-center font-bold"
                />
                <button
                  onClick={() => removeEntry(e.product_id)}
                  aria-label="Quitar"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="p-3 border-t border-border bg-card space-y-2">
            {summary.ready < summary.total && (
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <AlertTriangle size={11} className="text-yellow-600" />
                {summary.total - summary.ready} producto(s) sin contar — se omitirán
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setEntries([]); toast.info("Borrador descartado"); }}
                disabled={applying}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={applyAll}
                disabled={applying || summary.ready === 0}
                className="flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Aplicar {summary.ready} ajuste{summary.ready === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted"
        >
          <X size={16} />
        </button>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "default" | "primary" | "destructive" | "success" }) {
  const cls = tone === "primary"
    ? "text-primary"
    : tone === "destructive"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div>
      <p className={`text-lg font-bold leading-none ${cls}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}
