import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ShoppingCart, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Row = {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  current_stock: number;
  reorder_point: number;
  avg_daily_sales: number;
  suggested_qty: number;
  supplier_id: string | null;
  supplier_name: string | null;
  unit_cost: number | null;
  pack_size: number;
  estimated_total: number;
};

interface Props {
  orgId: string;
  warehouseId?: string;
}

export default function PurchaseSuggestionsSheet({ orgId, warehouseId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [coverage, setCoverage] = useState(14);
  const [lookback, setLookback] = useState(30);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["purchase-suggestions", orgId, lookback, coverage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("suggest_purchase_orders", {
        _organization_id: orgId,
        _lookback_days: lookback,
        _coverage_days: coverage,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: open,
  });

  // Group by supplier
  const grouped = useMemo(() => {
    const groups: Record<string, { name: string; supplierId: string | null; rows: Row[] }> = {};
    (data ?? []).forEach((r) => {
      const key = r.supplier_id ?? "__nopref__";
      const name = r.supplier_name ?? "Sin proveedor preferido";
      if (!groups[key]) groups[key] = { name, supplierId: r.supplier_id, rows: [] };
      groups[key].rows.push(r);
    });
    return Object.values(groups);
  }, [data]);

  const toggle = (r: Row, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (on) next[r.product_id] = Math.max(r.suggested_qty, 1);
      else delete next[r.product_id];
      return next;
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setSelected((prev) => ({ ...prev, [productId]: Math.max(qty, 0) }));
  };

  const selectedTotal = useMemo(() => {
    return (data ?? []).reduce((sum, r) => {
      const qty = selected[r.product_id] ?? 0;
      return sum + qty * (r.unit_cost ?? 0);
    }, 0);
  }, [data, selected]);

  const generatePOs = async () => {
    if (!warehouseId) return toast.error("Crea una bodega primero");
    const picked = (data ?? []).filter((r) => selected[r.product_id]);
    if (!picked.length) return toast.error("Selecciona al menos un producto");

    // Group selections by supplier
    const bySupplier: Record<string, Row[]> = {};
    picked.forEach((r) => {
      if (!r.supplier_id) return;
      (bySupplier[r.supplier_id] ||= []).push(r);
    });

    const supplierIds = Object.keys(bySupplier);
    if (!supplierIds.length) return toast.error("Los seleccionados no tienen proveedor preferido. Vincúlalos primero.");

    setGenerating(true);
    try {
      let createdCount = 0;
      for (const supplierId of supplierIds) {
        const rows = bySupplier[supplierId];
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .insert([{
            organization_id: orgId,
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            status: "draft",
            notes: "Generada por sugerencia automática",
          }])
          .select("id")
          .single();
        if (poErr) throw poErr;

        const items = rows.map((r) => ({
          organization_id: orgId,
          purchase_order_id: po!.id,
          product_id: r.product_id,
          quantity_ordered: selected[r.product_id],
          unit_cost: r.unit_cost ?? 0,
        }));
        const { error: itemsErr } = await supabase.from("purchase_order_items").insert(items);
        if (itemsErr) throw itemsErr;
        createdCount++;
      }
      toast.success(`${createdCount} OC creadas en borrador`);
      qc.invalidateQueries({ queryKey: ["purchase-orders", orgId] });
      setSelected({});
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error al generar OCs");
    } finally {
      setGenerating(false);
    }
  };

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Sparkles className="w-4 h-4 mr-1" />Sugerencias
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Sugerencias de compra
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Histórico (días)</Label>
              <Input type="number" min={7} max={180} value={lookback} onChange={(e) => setLookback(+e.target.value || 30)} />
            </div>
            <div>
              <Label className="text-xs">Cobertura objetivo (días)</Label>
              <Input type="number" min={1} max={90} value={coverage} onChange={(e) => setCoverage(+e.target.value || 14)} />
            </div>
          </div>

          <Button variant="secondary" onClick={() => refetch()} disabled={isLoading} className="w-full">
            Recalcular
          </Button>

          {isLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          )}

          {!isLoading && !grouped.length && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No hay sugerencias. Esto puede deberse a que no hay ventas históricas o todos los stocks están sanos.
            </Card>
          )}

          {!isLoading && grouped.map((g) => (
            <Card key={g.supplierId ?? "none"} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{g.name}</h3>
                  {!g.supplierId && (
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle className="w-3 h-3 mr-1" />Sin proveedor
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary">{g.rows.length}</Badge>
              </div>

              <div className="space-y-2">
                {g.rows.map((r) => {
                  const isSelected = !!selected[r.product_id];
                  const qty = selected[r.product_id] ?? r.suggested_qty;
                  return (
                    <div key={r.product_id} className="flex items-start gap-2 p-2 border rounded-md">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => toggle(r, !!v)}
                        disabled={!r.supplier_id}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{r.product_name}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                          <span>Stock: {Number(r.current_stock).toFixed(0)}</span>
                          <span>ROP: {Number(r.reorder_point).toFixed(0)}</span>
                          <span>Venta/día: {Number(r.avg_daily_sales).toFixed(1)}</span>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2 mt-2">
                            <Label className="text-xs">Cant:</Label>
                            <Input
                              type="number"
                              min={0}
                              className="h-7 w-20"
                              value={qty}
                              onChange={(e) => updateQty(r.product_id, +e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">
                              × {fmtCOP(r.unit_cost ?? 0)} = <strong>{fmtCOP(qty * (r.unit_cost ?? 0))}</strong>
                            </span>
                          </div>
                        )}
                        {!isSelected && (
                          <div className="text-xs text-primary mt-1">
                            Sugerido: {Number(r.suggested_qty).toFixed(0)} · {fmtCOP(r.estimated_total)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        {Object.keys(selected).length > 0 && (
          <div className="sticky bottom-0 bg-background border-t mt-4 pt-3 pb-2 -mx-6 px-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{Object.keys(selected).length} ítems seleccionados</span>
              <strong>{fmtCOP(selectedTotal)}</strong>
            </div>
            <Button onClick={generatePOs} disabled={generating} className="w-full">
              <ShoppingCart className="w-4 h-4 mr-2" />
              {generating ? "Generando…" : "Generar órdenes de compra"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
