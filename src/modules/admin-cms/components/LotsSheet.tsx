import { useCallback, useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseProductLotRepository as lotRepo } from "@/infrastructure/database/SupabaseProductLotRepository";
import type { ProductLot } from "@/core/ports/IProductLotRepository";

type Props = {
  open: boolean;
  onClose: () => void;
  orgId: string | undefined;
  productId: string | null;
  productName?: string;
  warehouseId: string;
  warehouseName?: string;
  onChanged?: () => void;
};

const daysLeft = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(`${iso}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
};

const severityOf = (iso: string | null) => {
  const d = daysLeft(iso);
  if (d === null) return { label: "Sin vencimiento", variant: "secondary" as const };
  if (d < 0) return { label: `Vencido (${Math.abs(d)}d)`, variant: "destructive" as const };
  if (d <= 7) return { label: `Vence en ${d}d`, variant: "destructive" as const };
  if (d <= 30) return { label: `Vence en ${d}d`, variant: "outline" as const };
  return { label: `Vence en ${d}d`, variant: "secondary" as const };
};

export default function LotsSheet({
  open, onClose, orgId, productId, productName, warehouseId, warehouseName, onChanged,
}: Props) {
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ lot_code: "", expires_at: "", quantity: "", unit_cost: "", notes: "" });

  const load = useCallback(async () => {
    if (!orgId || !productId || !warehouseId) return;
    setLoading(true);
    try {
      setLots(await lotRepo.listByProduct(orgId, productId, warehouseId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los lotes");
    } finally {
      setLoading(false);
    }
  }, [orgId, productId, warehouseId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const totalQty = useMemo(() => lots.reduce((s, l) => s + Number(l.quantity || 0), 0), [lots]);

  const submit = async () => {
    if (!orgId || !productId) return;
    const qty = Number(form.quantity);
    if (!form.lot_code.trim()) return toast.error("Indica el código de lote");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Cantidad inválida");
    setSaving(true);
    try {
      await lotRepo.create(orgId, productId, warehouseId, {
        lot_code: form.lot_code.trim(),
        expires_at: form.expires_at || null,
        manufactured_at: null,
        quantity: qty,
        unit_cost: Number(form.unit_cost) || 0,
        notes: form.notes.trim() || null,
      });
      toast.success("Lote registrado");
      setForm({ lot_code: "", expires_at: "", quantity: "", unit_cost: "", notes: "" });
      await load();
      onChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      toast.error(msg.includes("unique") ? "Ese código de lote ya existe en esta bodega" : msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (lot: ProductLot) => {
    if (!window.confirm(`¿Dar de baja el lote ${lot.lot_code}?`)) return;
    try {
      await lotRepo.deactivate(lot.id);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo dar de baja");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 text-base font-heading">
            <CalendarClock size={18} className="text-primary" />
            Lotes y caducidad
          </SheetTitle>
          <SheetDescription className="text-xs">
            {productName || "Producto"} · {warehouseName || "Bodega"} · {totalQty} unidades en {lots.length} lote(s)
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          {!loading && lots.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              Sin lotes registrados. Agrega el primero abajo para habilitar salida FEFO.
            </p>
          )}
          {!loading && lots.map((lot) => {
            const sev = severityOf(lot.expires_at);
            return (
              <div key={lot.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{lot.lot_code}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {lot.expires_at ? `Vence ${lot.expires_at}` : "Sin fecha de vencimiento"}
                    {lot.unit_cost ? ` · Costo $${Number(lot.unit_cost).toLocaleString("es-CO")}` : ""}
                  </p>
                  <Badge variant={sev.variant} className="mt-1 text-[10px]">{sev.label}</Badge>
                </div>
                <p className="text-sm font-bold tabular-nums">{Number(lot.quantity)}</p>
                <button
                  onClick={() => remove(lot)}
                  aria-label={`Dar de baja lote ${lot.lot_code}`}
                  className="p-2 rounded-lg bg-destructive/10 text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Nuevo lote</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.lot_code}
              onChange={(e) => setForm({ ...form, lot_code: e.target.value })}
              placeholder="Código de lote"
              aria-label="Código de lote"
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              aria-label="Fecha de vencimiento"
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="Cantidad"
              aria-label="Cantidad"
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              placeholder="Costo unitario"
              aria-label="Costo unitario"
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm"
            />
          </div>
          <button
            onClick={submit}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Registrar lote
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
