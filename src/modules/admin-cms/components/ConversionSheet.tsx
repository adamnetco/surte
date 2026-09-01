import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, Loader2, Search, PackageOpen, History, Save, Trash2, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { inventoryConversionRepository } from "../infrastructure/SupabaseInventoryConversionRepository";
import type { ConversionLogEntry, ConversionRule } from "@/core/ports/IInventoryConversionRepository";
import { computeConversion, factorBetweenPresentations } from "@/core/use-cases/inventory/purchaseUnits";

type StockRow = {
  product_id: string;
  presentation_id: string | null;
  quantity: number;
  avg_cost: number;
  product?: { name: string; sku: string | null };
};
type Presentation = { id: string; product_id: string; name: string; conversion_factor: number };

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  warehouseId: string;
  warehouseName?: string;
  onApplied?: () => void;
}

type Tab = "convertir" | "reglas" | "historial";

export default function ConversionSheet({ open, onClose, orgId, warehouseId, warehouseName, onApplied }: Props) {
  const [tab, setTab] = useState<Tab>("convertir");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<StockRow | null>(null);
  const [toPresentationId, setToPresentationId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [factor, setFactor] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rules, setRules] = useState<ConversionRule[]>([]);
  const [history, setHistory] = useState<ConversionLogEntry[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [ruleId, setRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrigin(null); setQty(1); setFactor(1); setNotes(""); setSearch("");
    setRuleName(""); setRuleId(null); setToPresentationId("");
  }, [open, warehouseId]);

  useEffect(() => {
    if (!open || !warehouseId) return;
    (async () => {
      setLoading(true);
      const { data: stk } = await supabase
        .from("product_stock")
        .select("product_id, presentation_id, quantity, avg_cost")
        .eq("organization_id", orgId)
        .eq("warehouse_id", warehouseId)
        .gt("quantity", 0);
      const ids = [...new Set((stk ?? []).map((s) => s.product_id))];
      let map: Record<string, { name: string; sku: string | null }> = {};
      if (ids.length) {
        const { data: pdata } = await supabase.from("products").select("id, name, sku").in("id", ids);
        map = Object.fromEntries((pdata ?? []).map((p) => [p.id, { name: p.name, sku: p.sku }]));
        const { data: pres } = await supabase
          .from("product_presentations")
          .select("id, product_id, name, conversion_factor")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .in("product_id", ids);
        setPresentations((pres ?? []).map((p) => ({ ...p, conversion_factor: Number(p.conversion_factor) })));
      }
      setStock((stk ?? []).map((s) => ({
        ...s,
        quantity: Number(s.quantity),
        avg_cost: Number(s.avg_cost ?? 0),
        product: map[s.product_id],
      })));
      setLoading(false);
    })();
  }, [open, warehouseId, orgId]);

  useEffect(() => {
    if (!open) return;
    if (tab === "reglas") {
      inventoryConversionRepository.listRules(orgId).then(setRules).catch(() => setRules([]));
    }
    if (tab === "historial") {
      inventoryConversionRepository.listHistory(orgId, warehouseId).then(setHistory).catch(() => setHistory([]));
    }
  }, [open, tab, orgId, warehouseId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [] as StockRow[];
    return stock
      .filter((s) => s.product?.name?.toLowerCase().includes(q) || s.product?.sku?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [stock, search]);

  const originPresentations = useMemo(
    () => (origin ? presentations.filter((p) => p.product_id === origin.product_id) : []),
    [presentations, origin],
  );

  const productName = (id: string) => stock.find((s) => s.product_id === id)?.product?.name ?? "Artículo";

  const pickOrigin = (row: StockRow) => {
    setOrigin(row);
    setSearch("");
    const target = presentations.find(
      (p) => p.product_id === row.product_id && p.id !== row.presentation_id,
    );
    setToPresentationId(target?.id ?? "");
    const fromFactor = presentations.find((p) => p.id === row.presentation_id)?.conversion_factor ?? 1;
    setFactor(factorBetweenPresentations(fromFactor, target?.conversion_factor ?? 1));
  };

  const onChangeTarget = (id: string) => {
    setToPresentationId(id);
    if (!origin) return;
    const fromFactor = presentations.find((p) => p.id === origin.presentation_id)?.conversion_factor ?? 1;
    const toFactor = presentations.find((p) => p.id === id)?.conversion_factor ?? 1;
    setFactor(factorBetweenPresentations(fromFactor, toFactor));
  };

  const preview = useMemo(
    () => computeConversion({ qtyFrom: qty, factor, avgCostFrom: origin?.avg_cost ?? 0 }),
    [qty, factor, origin],
  );

  const applyRule = (r: ConversionRule) => {
    const row = stock.find(
      (s) => s.product_id === r.from_product_id && (s.presentation_id ?? null) === (r.from_presentation_id ?? null),
    );
    if (!row) { toast.error("La regla no tiene existencia disponible en esta bodega"); return; }
    setOrigin(row);
    setToPresentationId(r.to_presentation_id ?? "");
    setFactor(r.factor);
    setRuleId(r.id);
    setTab("convertir");
  };

  const submit = async () => {
    if (!origin) { toast.error("Selecciona el artículo de origen"); return; }
    if (qty <= 0) { toast.error("La cantidad debe ser mayor a 0"); return; }
    if (qty > origin.quantity) { toast.error(`Solo hay ${origin.quantity} disponibles`); return; }
    if (!toPresentationId && !ruleId) { toast.error("Selecciona la presentación destino"); return; }
    setSubmitting(true);
    try {
      const res = await inventoryConversionRepository.execute(orgId, {
        warehouseId,
        fromProductId: origin.product_id,
        fromPresentationId: origin.presentation_id,
        toProductId: origin.product_id,
        toPresentationId: toPresentationId || null,
        qty,
        factor,
        notes: notes || null,
        ruleId,
      });
      toast.success(`Conversión aplicada · ${res.qtyTo} unidades destino`);
      setQty(1); setNotes(""); setOrigin(null); setRuleId(null);
      onApplied?.();
      setTab("historial");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo convertir el inventario");
    } finally {
      setSubmitting(false);
    }
  };

  const saveRule = async () => {
    if (!origin || !ruleName.trim()) { toast.error("Define origen y nombre de la regla"); return; }
    try {
      await inventoryConversionRepository.saveRule(orgId, {
        name: ruleName.trim(),
        from_product_id: origin.product_id,
        from_presentation_id: origin.presentation_id,
        to_product_id: origin.product_id,
        to_presentation_id: toPresentationId || null,
        factor,
      });
      toast.success("Regla guardada");
      setRuleName("");
      setRules(await inventoryConversionRepository.listRules(orgId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la regla");
    }
  };

  const removeRule = async (r: ConversionRule) => {
    if (!window.confirm(`¿Eliminar la regla "${r.name}"?`)) return;
    try {
      await inventoryConversionRepository.deleteRule(orgId, r.id);
      setRules((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Regla eliminada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 text-base font-heading">
            <Boxes size={18} className="text-primary" />
            Conversión de empaques
          </SheetTitle>
          <SheetDescription className="text-xs">
            Desempaca bultos o cajas a unidades sueltas en {warehouseName ?? "la bodega actual"} sin perder el costo.
          </SheetDescription>
          <div className="flex gap-1.5 pt-2" role="tablist">
            {([
              { k: "convertir" as const, label: "Convertir" },
              { k: "reglas" as const, label: "Reglas" },
              { k: "historial" as const, label: "Historial" },
            ]).map(({ k, label }) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`flex-1 min-h-[40px] px-2 rounded-lg text-xs font-semibold transition ${
                  tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>

        {tab === "convertir" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar artículo con existencia..."
                aria-label="Buscar artículo de origen"
                className="w-full pl-9 pr-3 min-h-[44px] rounded-xl bg-background border border-border text-sm"
              />
            </div>

            {search && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background">
                {loading && (
                  <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Cargando…
                  </div>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">Sin coincidencias con existencia.</div>
                )}
                {filtered.map((s) => (
                  <button
                    key={`${s.product_id}-${s.presentation_id ?? "base"}`}
                    onClick={() => pickOrigin(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-b-0"
                  >
                    <p className="text-sm font-medium truncate">{s.product?.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      SKU {s.product?.sku ?? "—"} · {s.quantity} disp. · costo ${s.avg_cost.toLocaleString("es-CO")}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {origin && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Origen</p>
                  <p className="text-sm font-semibold">{origin.product?.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {presentations.find((p) => p.id === origin.presentation_id)?.name ?? "Unidad base"} ·{" "}
                    {origin.quantity} disp.
                  </p>
                </div>

                <div className="flex justify-center text-muted-foreground"><ArrowDown size={16} /></div>

                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase" htmlFor="conv-target">
                    Presentación destino
                  </label>
                  <select
                    id="conv-target"
                    value={toPresentationId}
                    onChange={(e) => onChangeTarget(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-background border border-border text-sm"
                  >
                    <option value="">Unidad base</option>
                    {originPresentations
                      .filter((p) => p.id !== origin.presentation_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (×{p.conversion_factor})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="conv-qty">
                      Cantidad origen
                    </label>
                    <input
                      id="conv-qty"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-background border border-border text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground" htmlFor="conv-factor">
                      Factor
                    </label>
                    <input
                      id="conv-factor"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={factor}
                      onChange={(e) => setFactor(Number(e.target.value))}
                      className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-background border border-border text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div
                  className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
                  role="status"
                  aria-live="polite"
                >
                  Resultado: <strong className="tabular-nums">{preview.qtyTo}</strong> unidades destino · costo
                  unitario <strong className="tabular-nums">${preview.unitCostTo.toLocaleString("es-CO")}</strong>
                </div>

                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nota (opcional)"
                  aria-label="Nota de la conversión"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-background border border-border text-sm"
                />

                <button
                  onClick={submit}
                  disabled={submitting}
                  className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <PackageOpen size={16} />}
                  Aplicar conversión
                </button>

                <div className="flex gap-2 pt-1">
                  <input
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Guardar como regla…"
                    aria-label="Nombre de la regla"
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-background border border-border text-sm"
                  />
                  <button
                    onClick={saveRule}
                    className="min-h-[44px] px-3 rounded-xl border border-border bg-card text-sm font-semibold flex items-center gap-1.5"
                  >
                    <Save size={14} /> Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reglas" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {rules.length === 0 && (
              <p className="text-center py-12 text-sm text-muted-foreground">
                Aún no hay reglas guardadas. Crea una desde la pestaña Convertir.
              </p>
            )}
            {rules.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
                <button onClick={() => applyRule(r)} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {productName(r.from_product_id)} · factor ×{r.factor}
                  </p>
                </button>
                <button
                  onClick={() => removeRule(r)}
                  aria-label={`Eliminar regla ${r.name}`}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "historial" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 && (
              <p className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center gap-2">
                <History size={20} /> Sin conversiones registradas en esta bodega.
              </p>
            )}
            {history.map((h) => (
              <div key={h.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold truncate">{productName(h.from_product_id)}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {h.qty_from} → {h.qty_to} (×{h.factor}) · {new Date(h.created_at).toLocaleString("es-CO")}
                </p>
                {h.notes && <p className="text-[11px] text-muted-foreground mt-1">{h.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
