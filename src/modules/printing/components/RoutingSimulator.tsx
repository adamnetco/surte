// Simulador de enrutamiento (Slice H — preview vivo).
// Replica la lógica del RPC enqueue_print_job en cliente:
// Producto > Categoría > Estación → desempate por prioridad ASC.
// Permite seleccionar productos + canal y muestra, por ítem, a qué impresora(s)
// caería la comanda y con cuántas copias, sin enviar nada real.
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer, FlaskConical, X, ArrowRight } from "lucide-react";

interface Printer { id: string; name: string; role: string; }
interface Station { id: string; name: string; default_printer_id?: string | null; }
interface Category { id: string; name: string; }
interface Product { id: string; name: string; category_id?: string | null; kitchen_station_id?: string | null; }
interface Rule {
  id: string;
  printer_id: string;
  category_id: string | null;
  product_id: string | null;
  kitchen_station_id: string | null;
  prints_on: "receipt" | "kitchen" | "both";
  copies: number;
  priority: number;
  is_active: boolean;
}

interface Props {
  printers: Printer[];
  stations: Station[];
  categories: Category[];
  products: Product[];
  rules: Rule[];
}

type Channel = "kitchen" | "receipt";

interface ResolvedDest {
  printerId: string;
  printerName: string;
  copies: number;
  source: "product" | "category" | "station" | "default";
  priority: number;
}

function resolveItem(
  product: Product,
  channel: Channel,
  ctx: { printers: Printer[]; stations: Station[]; rules: Rule[] },
): ResolvedDest[] {
  const active = ctx.rules.filter(
    (r) => r.is_active && (r.prints_on === channel || r.prints_on === "both"),
  );
  // Producto
  const byProduct = active
    .filter((r) => r.product_id === product.id)
    .sort((a, b) => a.priority - b.priority);
  if (byProduct.length > 0) return mapRules(byProduct, "product", ctx.printers);
  // Categoría
  if (product.category_id) {
    const byCat = active
      .filter((r) => r.category_id === product.category_id)
      .sort((a, b) => a.priority - b.priority);
    if (byCat.length > 0) return mapRules(byCat, "category", ctx.printers);
  }
  // Estación
  if (product.kitchen_station_id) {
    const byStation = active
      .filter((r) => r.kitchen_station_id === product.kitchen_station_id)
      .sort((a, b) => a.priority - b.priority);
    if (byStation.length > 0) return mapRules(byStation, "station", ctx.printers);
    // Default printer de la estación
    const st = ctx.stations.find((s) => s.id === product.kitchen_station_id);
    if (st?.default_printer_id) {
      const p = ctx.printers.find((x) => x.id === st.default_printer_id);
      if (p) return [{ printerId: p.id, printerName: p.name, copies: 1, source: "default", priority: 999 }];
    }
  }
  return [];
}

function mapRules(rules: Rule[], source: ResolvedDest["source"], printers: Printer[]): ResolvedDest[] {
  return rules.map((r) => {
    const p = printers.find((x) => x.id === r.printer_id);
    return {
      printerId: r.printer_id,
      printerName: p?.name ?? "—",
      copies: r.copies,
      source,
      priority: r.priority,
    };
  });
}

const SOURCE_LABEL: Record<ResolvedDest["source"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  product: { label: "Producto", variant: "default" },
  category: { label: "Categoría", variant: "secondary" },
  station: { label: "Estación", variant: "outline" },
  default: { label: "Por defecto", variant: "outline" },
};

export function RoutingSimulator({ printers, stations, categories, products, rules }: Props) {
  const [channel, setChannel] = useState<Channel>("kitchen");
  const [picked, setPicked] = useState<string[]>([]);
  const [selectKey, setSelectKey] = useState(0);

  const pickedProducts = useMemo(
    () => picked.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [picked, products],
  );

  const results = useMemo(
    () => pickedProducts.map((p) => ({
      product: p,
      destinations: resolveItem(p, channel, { printers, stations, rules }),
    })),
    [pickedProducts, channel, printers, stations, rules],
  );

  const summary = useMemo(() => {
    const map = new Map<string, { name: string; items: string[]; copies: number }>();
    for (const r of results) {
      for (const d of r.destinations) {
        const key = d.printerId;
        const cur = map.get(key) ?? { name: d.printerName, items: [], copies: 0 };
        cur.items.push(r.product.name);
        cur.copies = Math.max(cur.copies, d.copies);
        map.set(key, cur);
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [results]);

  const addProduct = (id: string) => {
    if (!id || picked.includes(id)) return;
    setPicked([...picked, id]);
    setSelectKey((k) => k + 1);
  };

  return (
    <Card className="p-4 space-y-4 border-dashed">
      <div className="flex items-start gap-3">
        <FlaskConical className="h-5 w-5 mt-0.5 text-primary" />
        <div className="flex-1">
          <h4 className="font-bold">Simulador de enrutamiento</h4>
          <p className="text-xs text-muted-foreground">
            Construye una orden de prueba y visualiza, por ítem, a qué impresora caería con las reglas actuales.
            No envía jobs reales.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Canal</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kitchen">Comanda cocina</SelectItem>
              <SelectItem value="receipt">Recibo / Factura</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Añadir producto</Label>
          <Select key={selectKey} onValueChange={addProduct}>
            <SelectTrigger><SelectValue placeholder="Selecciona un producto…" /></SelectTrigger>
            <SelectContent>
              {products.filter((p) => !picked.includes(p.id)).slice(0, 200).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pickedProducts.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-6 border rounded-md border-dashed">
          Añade productos para ver el routing en vivo.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(({ product, destinations }) => {
            const cat = categories.find((c) => c.id === product.category_id);
            const st = stations.find((s) => s.id === product.kitchen_station_id);
            return (
              <div key={product.id} className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{product.name}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => setPicked(picked.filter((id) => id !== product.id))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                    {cat && <span>cat: {cat.name}</span>}
                    {st && <span>estación: {st.name}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  {destinations.length === 0 ? (
                    <Badge variant="destructive" className="text-[10px]">Sin destino</Badge>
                  ) : destinations.map((d, i) => {
                    const meta = SOURCE_LABEL[d.source];
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Printer className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{d.printerName}</span>
                        <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                        <span className="text-muted-foreground">×{d.copies}</span>
                        <span className="text-muted-foreground">· prio {d.priority}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {summary.length > 0 && (
            <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20">
              <div className="text-xs font-bold mb-2">Resumen: {summary.length} job(s) generados</div>
              <div className="space-y-1">
                {summary.map((s) => (
                  <div key={s.id} className="text-xs flex items-center gap-2">
                    <Printer className="h-3 w-3" />
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">— {s.items.length} ítem(s) × {s.copies}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
