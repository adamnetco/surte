import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ChevronLeft, Clock, Package, TrendingUp, AlertTriangle } from "lucide-react";

interface Props { orgId: string; trigger?: React.ReactNode }

type Row = {
  supplier_id: string; supplier_name: string; city: string | null;
  lead_time_target: number | null; po_count: number; total_value: number;
  avg_lead_time_real: number | null; on_time_rate: number | null;
  fill_rate: number | null; last_order_at: string | null;
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const pct = (n: number | null) => n == null ? "—" : `${Math.round(n * 100)}%`;
const days = (n: number | null) => n == null ? "—" : `${n.toFixed(1)}d`;

export default function SupplierPerformanceSheet({ orgId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [windowDays, setWindowDays] = useState("90");
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["supplier-perf", orgId, windowDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("supplier_performance", {
        p_org: orgId, p_days: Number(windowDays),
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: open && !!orgId,
  });

  const { data: variations, isLoading: loadingVar } = useQuery({
    queryKey: ["supplier-variations", orgId, selected?.supplier_id, windowDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("supplier_price_variations", {
        p_org: orgId, p_supplier_id: selected!.supplier_id, p_days: Number(windowDays) * 2,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selected,
  });

  const onTimeBadge = (r: number | null) => {
    if (r == null) return <Badge variant="secondary">s/d</Badge>;
    const p = r * 100;
    if (p >= 85) return <Badge className="bg-success text-success-foreground">{p.toFixed(0)}%</Badge>;
    if (p >= 60) return <Badge className="bg-accent text-accent-foreground">{p.toFixed(0)}%</Badge>;
    return <Badge variant="destructive">{p.toFixed(0)}%</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null); }}>
      <SheetTrigger asChild>
        {trigger ?? <Button variant="outline"><BarChart3 className="w-4 h-4 mr-1" />Desempeño</Button>}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {selected && (
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <BarChart3 className="w-5 h-5 text-primary" />
            {selected ? `Variación de precios — ${selected.supplier_name}` : "Desempeño de proveedores"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!selected && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ventana:</span>
                <Select value={windowDays} onValueChange={setWindowDays}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="90">90 días</SelectItem>
                    <SelectItem value="180">180 días</SelectItem>
                    <SelectItem value="365">365 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : !rows?.length ? (
                <Card className="p-8 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  Sin órdenes de compra en este período.
                </Card>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="lg:hidden space-y-2">
                    {rows.map((r) => (
                      <Card key={r.supplier_id} className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.supplier_name}</div>
                            <div className="text-xs text-muted-foreground">{r.city ?? "—"} · {r.po_count} OC</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">{fmt(r.total_value)}</div>
                            {onTimeBadge(r.on_time_rate)}
                          </div>
                        </div>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span><Clock className="w-3 h-3 inline mr-1" />Real: {days(r.avg_lead_time_real)} / Meta: {r.lead_time_target ?? 0}d</span>
                          <span>Fill: {pct(r.fill_rate)}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">OCs</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Lead real</TableHead>
                        <TableHead className="text-right">A tiempo</TableHead>
                        <TableHead className="text-right">Fill rate</TableHead>
                        <TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.supplier_id}>
                            <TableCell className="font-medium">{r.supplier_name}
                              <div className="text-xs text-muted-foreground">{r.city ?? "—"}</div>
                            </TableCell>
                            <TableCell className="text-right">{r.po_count}</TableCell>
                            <TableCell className="text-right">{fmt(r.total_value)}</TableCell>
                            <TableCell className="text-right">
                              {days(r.avg_lead_time_real)}
                              {r.avg_lead_time_real != null && r.lead_time_target && r.avg_lead_time_real > r.lead_time_target * 1.3 && (
                                <AlertTriangle className="w-3 h-3 inline ml-1 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell className="text-right">{onTimeBadge(r.on_time_rate)}</TableCell>
                            <TableCell className="text-right">{pct(r.fill_rate)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                                <TrendingUp className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </>
          )}

          {selected && (
            <>
              <Card className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="OCs" value={String(selected.po_count)} />
                <Stat label="Total" value={fmt(selected.total_value)} />
                <Stat label="Lead real" value={days(selected.avg_lead_time_real)} />
                <Stat label="A tiempo" value={pct(selected.on_time_rate)} />
              </Card>

              {loadingVar ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : !variations?.length ? (
                <Card className="p-6 text-center text-muted-foreground text-sm">
                  Sin datos de costo por producto.
                </Card>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Mín</TableHead>
                    <TableHead className="text-right">Último</TableHead>
                    <TableHead className="text-right">Máx</TableHead>
                    <TableHead className="text-right">Variación</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {variations.map((v: any) => {
                      const vp = Number(v.variation_pct) * 100;
                      return (
                        <TableRow key={v.product_id}>
                          <TableCell className="font-medium">{v.product_name ?? "—"}
                            <div className="text-xs text-muted-foreground">{v.sku ?? ""}</div>
                          </TableCell>
                          <TableCell className="text-right">{v.buys}</TableCell>
                          <TableCell className="text-right">{fmt(Number(v.min_cost))}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(Number(v.last_cost))}</TableCell>
                          <TableCell className="text-right">{fmt(Number(v.max_cost))}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={vp > 25 ? "destructive" : vp > 10 ? "secondary" : "outline"}>
                              {vp.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
