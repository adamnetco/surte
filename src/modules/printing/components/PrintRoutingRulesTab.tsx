// Reglas avanzadas de enrutamiento de impresión.
// Permiten anular el destino por defecto (estación → impresora) y "copiar" comandas
// a impresoras secundarias por producto, categoría o estación, con prioridad explícita.
// Resolución (en RPC enqueue_print_job): producto > categoría > estación → prioridad ASC.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Printer, Zap, Info, History } from "lucide-react";
import { toast } from "sonner";
import { RoutingSimulator } from "./RoutingSimulator";
import { RuleJobsDialog } from "./RuleJobsDialog";

interface PrinterRow { id: string; name: string; role: string; }
interface StationRow { id: string; name: string; default_printer_id?: string | null; }
interface CategoryRow { id: string; name: string; }
interface ProductRow { id: string; name: string; category_id?: string | null; kitchen_station_id?: string | null; }
interface RuleRow {
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

const NONE = "__none__";

export function PrintRoutingRulesTab({ organizationId }: { organizationId: string }) {
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  // formulario nueva regla
  const [form, setForm] = useState({
    target_kind: "category" as "product" | "category" | "station",
    target_id: "" as string,
    printer_id: "",
    prints_on: "kitchen" as RuleRow["prints_on"],
    copies: 1,
    priority: 100,
  });
  const [drillRule, setDrillRule] = useState<{ id: string; label: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: pr }, { data: st }, { data: ct }, { data: pd }, { data: rl }] = await Promise.all([
      (supabase as any).from("printers").select("id,name,role").eq("organization_id", organizationId).eq("is_active", true).order("name"),
      (supabase as any).from("kitchen_stations").select("id,name,default_printer_id").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
      (supabase as any).from("categories").select("id,name").order("name"),
      (supabase as any).from("products").select("id,name,category_id,kitchen_station_id").eq("organization_id", organizationId).order("name").limit(500),
      (supabase as any).from("printer_routing_rules").select("*").eq("organization_id", organizationId).order("priority", { ascending: true }),
    ]);
    setPrinters((pr ?? []) as PrinterRow[]);
    setStations((st ?? []) as StationRow[]);
    setCategories((ct ?? []) as CategoryRow[]);
    setProducts((pd ?? []) as ProductRow[]);
    setRules((rl ?? []) as RuleRow[]);
    setLoading(false);
  };

  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  const targetOptions = useMemo(() => {
    if (form.target_kind === "product") return products.map((p) => ({ id: p.id, name: p.name }));
    if (form.target_kind === "category") return categories.map((c) => ({ id: c.id, name: c.name }));
    return stations.map((s) => ({ id: s.id, name: s.name }));
  }, [form.target_kind, products, categories, stations]);

  const addRule = async () => {
    if (!form.printer_id || !form.target_id) {
      toast.error("Selecciona destino e impresora");
      return;
    }
    const payload: any = {
      organization_id: organizationId,
      printer_id: form.printer_id,
      prints_on: form.prints_on,
      copies: Math.max(1, form.copies),
      priority: form.priority,
      is_active: true,
      product_id: form.target_kind === "product" ? form.target_id : null,
      category_id: form.target_kind === "category" ? form.target_id : null,
      kitchen_station_id: form.target_kind === "station" ? form.target_id : null,
    };
    const { error } = await (supabase as any).from("printer_routing_rules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Regla creada");
    setForm({ ...form, target_id: "" });
    load();
  };

  const toggleActive = async (rule: RuleRow, next: boolean) => {
    const prev = rules;
    setRules(prev.map((r) => r.id === rule.id ? { ...r, is_active: next } : r));
    const { error } = await (supabase as any).from("printer_routing_rules").update({ is_active: next }).eq("id", rule.id);
    if (error) { setRules(prev); toast.error(error.message); }
  };

  const updatePriority = async (rule: RuleRow, value: number) => {
    const prev = rules;
    setRules(prev.map((r) => r.id === rule.id ? { ...r, priority: value } : r));
    const { error } = await (supabase as any).from("printer_routing_rules").update({ priority: value }).eq("id", rule.id);
    if (error) { setRules(prev); toast.error(error.message); }
  };

  const removeRule = async (id: string) => {
    if (!window.confirm("¿Eliminar regla?")) return;
    const { error } = await (supabase as any).from("printer_routing_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    load();
  };

  const describeTarget = (r: RuleRow) => {
    if (r.product_id) {
      const p = products.find((x) => x.id === r.product_id);
      return { kind: "Producto", label: p?.name ?? r.product_id };
    }
    if (r.category_id) {
      const c = categories.find((x) => x.id === r.category_id);
      return { kind: "Categoría", label: c?.name ?? r.category_id };
    }
    if (r.kitchen_station_id) {
      const s = stations.find((x) => x.id === r.kitchen_station_id);
      return { kind: "Estación", label: s?.name ?? r.kitchen_station_id };
    }
    return { kind: "—", label: "—" };
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Cargando reglas…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Zap className="h-5 w-5 mt-0.5 text-primary" />
        <div>
          <h3 className="text-lg font-bold">Reglas avanzadas de impresión</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Anula el destino por defecto de la estación o añade copias automáticas en impresoras
            secundarias. Resolución por ítem: <strong>Producto</strong> &gt; <strong>Categoría</strong> &gt; <strong>Estación</strong>,
            desempate por <strong>prioridad ascendente</strong> (menor número gana).
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-1">
            <Label>Aplicar a</Label>
            <Select value={form.target_kind} onValueChange={(v) => setForm({ ...form, target_kind: v as any, target_id: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="category">Categoría</SelectItem>
                <SelectItem value="station">Estación</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Destino</Label>
            <Select value={form.target_id || NONE} onValueChange={(v) => setForm({ ...form, target_id: v === NONE ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {targetOptions.length === 0 && <SelectItem value={NONE} disabled>Sin opciones</SelectItem>}
                {targetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Impresora</Label>
            <Select value={form.printer_id || NONE} onValueChange={(v) => setForm({ ...form, printer_id: v === NONE ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {printers.length === 0 && <SelectItem value={NONE} disabled>Sin impresoras</SelectItem>}
                {printers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.role}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Imprime</Label>
            <Select value={form.prints_on} onValueChange={(v) => setForm({ ...form, prints_on: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kitchen">Comanda</SelectItem>
                <SelectItem value="receipt">Recibo</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label>Copias</Label>
            <Input type="number" min={1} max={9} value={form.copies}
              onChange={(e) => setForm({ ...form, copies: Number(e.target.value) || 1 })} />
          </div>
          <div>
            <Label>Prioridad</Label>
            <Input type="number" min={1} max={999} value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 100 })} />
          </div>
          <div className="col-span-3 md:col-span-4 flex justify-end">
            <Button onClick={addRule}><Plus className="h-4 w-4 mr-1" />Agregar regla</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" /> Tip: usa prioridad <strong>10</strong> para reglas de excepción
          (un producto va a otra impresora) y <strong>100</strong> para reglas amplias por categoría.
        </p>
      </Card>

      <Card className="p-0 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aún no hay reglas. El enrutamiento usa la impresora por defecto de cada estación.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Prio.</TableHead>
                <TableHead>Aplica a</TableHead>
                <TableHead>Impresora</TableHead>
                <TableHead>Imprime</TableHead>
                <TableHead className="w-[80px]">Copias</TableHead>
                <TableHead className="w-[100px]">Activa</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => {
                const t = describeTarget(r);
                const printer = printers.find((p) => p.id === r.printer_id);
                return (
                  <TableRow key={r.id} className={r.is_active ? "" : "opacity-50"}>
                    <TableCell>
                      <Input type="number" className="h-8 w-16" value={r.priority}
                        onChange={(e) => updatePriority(r, Number(e.target.value) || 100)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{t.kind}</Badge>
                        <span className="font-medium">{t.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Printer className="h-3 w-3 text-muted-foreground" />
                        {printer?.name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{r.prints_on}</Badge></TableCell>
                    <TableCell>{r.copies}</TableCell>
                    <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => toggleActive(r, v)} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" title="Ver jobs recientes"
                          onClick={() => setDrillRule({ id: r.id, label: `${t.kind}: ${t.label}` })}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeRule(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <RoutingSimulator
        printers={printers}
        stations={stations}
        categories={categories}
        products={products}
        rules={rules}
      />
    </div>
  );
}
