import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { ArrowLeft, Warehouse as WarehouseIcon, Plus, Minus, RotateCcw, AlertTriangle, Search, ArrowRightLeft, Loader2, History, ClipboardList } from "lucide-react";
import KardexSheet from "../components/KardexSheet";
import CriticalStockSheet from "../components/CriticalStockSheet";
import ConteoFisicoSheet from "../components/ConteoFisicoSheet";
import TrasladoSheet from "../components/TrasladoSheet";
import { toast } from "sonner";

type Warehouse = { id: string; name: string; code: string | null; is_default: boolean; location_id: string; warehouse_type: string };
type StockRow = {
  id: string;
  warehouse_id: string;
  product_id: string;
  presentation_id: string | null;
  quantity: number;
  min_stock: number;
  reorder_point: number | null;
  avg_cost: number;
  product?: { name: string; sku: string | null; image_url: string | null };
};

export default function Inventario() {
  const nav = useNavigate();
  const { currentOrg } = useOrganization();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [movement, setMovement] = useState<{ row: StockRow | null; type: "in" | "out" | "adjustment" } | null>(null);
  const [kardex, setKardex] = useState<{ productId: string; name: string } | null>(null);
  const [criticalOpen, setCriticalOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      const { data } = await supabase.from("warehouses").select("*").eq("organization_id", currentOrg.id).eq("is_active", true).order("is_default", { ascending: false });
      setWarehouses(data ?? []);
      if (data?.length && !warehouseId) setWarehouseId(data[0].id);
    })();
  }, [currentOrg]);

  const loadStock = async () => {
    if (!warehouseId || !currentOrg) return;
    setLoading(true);
    const { data: stockData } = await supabase
      .from("product_stock")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .eq("warehouse_id", warehouseId);
    const productIds = [...new Set((stockData ?? []).map((s: any) => s.product_id))];
    let productsMap: Record<string, any> = {};
    if (productIds.length) {
      const { data: pdata } = await supabase.from("products").select("id, name, sku, image_url").in("id", productIds);
      productsMap = Object.fromEntries((pdata ?? []).map((p: any) => [p.id, p]));
    }
    setStock((stockData ?? []).map((s: any) => ({ ...s, product: productsMap[s.product_id] })));
    setLoading(false);
  };

  useEffect(() => { loadStock(); }, [warehouseId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return stock;
    return stock.filter((s) => s.product?.name?.toLowerCase().includes(q) || s.product?.sku?.toLowerCase().includes(q));
  }, [stock, search]);

  const lowStock = filtered.filter((s) => s.quantity <= (s.reorder_point ?? s.min_stock ?? 0));

  if (!currentOrg) return null;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground p-3 flex items-center gap-3 shadow">
        <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-white/10"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-base">Inventario</h1>
          <p className="text-[11px] opacity-80">{currentOrg.name}</p>
        </div>
        <WarehouseIcon size={20} />
      </header>

      {/* Warehouse selector */}
      <div className="p-3 bg-card border-b border-border flex gap-2 overflow-x-auto">
        {warehouses.map((w) => (
          <button
            key={w.id}
            onClick={() => setWarehouseId(w.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition ${
              warehouseId === w.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border"
            }`}
          >
            {w.name}{w.is_default && " ⭐"}
          </button>
        ))}
        {warehouses.length === 0 && <p className="text-xs text-muted-foreground">No hay bodegas configuradas.</p>}
      </div>

      {/* Search */}
      <div className="p-3 bg-card border-b border-border">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm"
          />
        </div>
        <button
          onClick={() => setCriticalOpen(true)}
          className="mt-2 w-full flex items-center justify-between gap-2 text-xs text-destructive bg-destructive/10 hover:bg-destructive/15 rounded-lg px-3 py-2 transition"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            {lowStock.length > 0
              ? <>{lowStock.length} producto(s) en o bajo punto de reorden <span className="opacity-70">(esta bodega)</span></>
              : <>Revisar stock crítico org-wide</>}
          </span>
          <span className="font-semibold">Ver →</span>
        </button>
      </div>

      {/* Stock list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="space-y-2" aria-busy="true" aria-live="polite" aria-label="Cargando inventario">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="bg-card rounded-xl p-3 border border-border flex gap-3 items-center">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sin existencias registradas en esta bodega.
            <p className="text-[11px] mt-2">Registra una entrada para empezar el kárdex.</p>
          </div>
        )}
        {filtered.map((row) => {
          const low = row.quantity <= (row.reorder_point ?? row.min_stock ?? 0);
          return (
            <div key={row.id} className={`bg-card rounded-xl p-3 border ${low ? "border-destructive/50" : "border-border"} flex gap-3 items-center`}>
              <img src={row.product?.image_url || "/placeholder.svg"} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{row.product?.name || "Producto"}</p>
                <p className="text-[11px] text-muted-foreground">SKU: {row.product?.sku || "—"} · Costo: ${row.avg_cost.toLocaleString("es-CO")}</p>
                <p className={`text-xs font-bold mt-0.5 ${low ? "text-destructive" : "text-foreground"}`}>{row.quantity} disponibles</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setMovement({ row, type: "in" })} className="p-2 rounded-lg bg-secondary text-secondary-foreground" title="Entrada"><Plus size={14} /></button>
                <button onClick={() => setMovement({ row, type: "out" })} className="p-2 rounded-lg bg-accent text-accent-foreground" title="Salida"><Minus size={14} /></button>
                <button onClick={() => setMovement({ row, type: "adjustment" })} className="p-2 rounded-lg bg-muted text-muted-foreground" title="Ajuste"><RotateCcw size={14} /></button>
                <button onClick={() => setKardex({ productId: row.product_id, name: row.product?.name || "Producto" })} className="p-2 rounded-lg bg-primary/10 text-primary" title="Ver kárdex"><History size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border bg-card flex gap-2">
        <button
          onClick={() => setCountOpen(true)}
          disabled={!warehouseId}
          className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ClipboardList size={16} /> Conteo físico
        </button>
        <button
          onClick={() => toast.info("Próximamente: traslados entre bodegas")}
          className="flex-1 bg-secondary text-secondary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <ArrowRightLeft size={16} /> Traslado
        </button>
        <button
          onClick={() => toast.info("Próximamente: órdenes de compra")}
          className="flex-1 bg-accent text-accent-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Compra
        </button>
      </div>

      {movement && (
        <MovementDialog
          row={movement.row!}
          type={movement.type}
          orgId={currentOrg.id}
          onClose={() => setMovement(null)}
          onSaved={() => { setMovement(null); loadStock(); }}
        />
      )}

      <KardexSheet
        open={!!kardex}
        onClose={() => setKardex(null)}
        productId={kardex?.productId ?? null}
        productName={kardex?.name}
        warehouseId={warehouseId}
      />

      <CriticalStockSheet
        open={criticalOpen}
        onClose={() => setCriticalOpen(false)}
        orgId={currentOrg.id}
      />

      <ConteoFisicoSheet
        open={countOpen}
        onClose={() => setCountOpen(false)}
        orgId={currentOrg.id}
        warehouseId={warehouseId}
        warehouseName={warehouses.find((w) => w.id === warehouseId)?.name}
        onApplied={loadStock}
      />
    </div>
  );
}

function MovementDialog({
  row, type, orgId, onClose, onSaved,
}: { row: StockRow; type: "in" | "out" | "adjustment"; orgId: string; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState<string>("");
  const [cost, setCost] = useState<string>(String(row.avg_cost || ""));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const label = type === "in" ? "Entrada" : type === "out" ? "Salida" : "Ajuste";

  const submit = async () => {
    const n = Number(qty);
    if (!n || n <= 0) { toast.error("Cantidad inválida"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("apply_stock_movement", {
      _org_id: orgId,
      _warehouse_id: row.warehouse_id,
      _product_id: row.product_id,
      _presentation_id: row.presentation_id,
      _movement_type: type,
      _quantity: n,
      _unit_cost: Number(cost) || 0,
      _reference_type: "manual",
      _reference_id: null,
      _notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${label} registrada`);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-bold text-lg">{label} — {row.product?.name}</h3>
        <p className="text-xs text-muted-foreground">Stock actual: <strong>{row.quantity}</strong></p>
        <div>
          <label className="text-xs font-semibold">Cantidad</label>
          <input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border" autoFocus />
        </div>
        {type === "in" && (
          <div>
            <label className="text-xs font-semibold">Costo unitario</label>
            <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border" />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold">Notas</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border" placeholder="Opcional" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold">Cancelar</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin inline" /> : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
