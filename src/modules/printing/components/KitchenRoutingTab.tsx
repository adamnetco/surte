// Mapeo visual: cada estación de cocina (y opcionalmente cada categoría) → impresora.
// Sin drag-drop: usamos Select por simplicidad y robustez en pantallas táctiles.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Tag, Plus, Trash2, Save, Printer } from "lucide-react";
import { toast } from "sonner";

interface PrinterRow { id: string; name: string; paper_width_mm: number; role: string; }
interface StationRow { id: string; name: string; color: string | null; printer_id: string | null; sort_order: number; is_active: boolean; }
interface CategoryRow { id: string; name: string; kitchen_station_id: string | null; }

const NONE = "__none__";

export function KitchenRoutingTab({ organizationId }: { organizationId: string }) {
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStation, setNewStation] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: pr }, { data: st }, { data: ct }] = await Promise.all([
      (supabase as any).from("printers").select("id,name,paper_width_mm,role").eq("organization_id", organizationId).eq("is_active", true).order("name"),
      (supabase as any).from("kitchen_stations").select("id,name,color,printer_id,sort_order,is_active").eq("organization_id", organizationId).order("sort_order"),
      (supabase as any).from("categories").select("id,name,kitchen_station_id").order("name"),
    ]);
    setPrinters((pr ?? []) as PrinterRow[]);
    setStations((st ?? []) as StationRow[]);
    setCategories((ct ?? []) as CategoryRow[]);
    setLoading(false);
  };

  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  const updateStationPrinter = async (stationId: string, printerId: string) => {
    const value = printerId === NONE ? null : printerId;
    const prev = stations;
    setStations(prev.map((s) => s.id === stationId ? { ...s, printer_id: value } : s));
    const { error } = await (supabase as any).from("kitchen_stations").update({ printer_id: value }).eq("id", stationId);
    if (error) { setStations(prev); toast.error(error.message); }
    else toast.success("Estación actualizada");
  };

  const updateCategoryStation = async (categoryId: string, stationId: string) => {
    const value = stationId === NONE ? null : stationId;
    const prev = categories;
    setCategories(prev.map((c) => c.id === categoryId ? { ...c, kitchen_station_id: value } : c));
    const { error } = await (supabase as any).from("categories").update({ kitchen_station_id: value }).eq("id", categoryId);
    if (error) { setCategories(prev); toast.error(error.message); }
  };

  const addStation = async () => {
    if (!newStation.trim()) return;
    const { error } = await (supabase as any).from("kitchen_stations").insert({
      organization_id: organizationId,
      name: newStation.trim(),
      sort_order: stations.length,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    setNewStation("");
    load();
  };

  const removeStation = async (id: string) => {
    if (!window.confirm("¿Eliminar esta estación? Las categorías y productos quedarán sin estación asignada.")) return;
    const { error } = await (supabase as any).from("kitchen_stations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2"><ChefHat className="h-5 w-5" /> Estaciones de cocina</h3>
        <p className="text-sm text-muted-foreground">Cada estación imprime sus comandas en la impresora asignada.</p>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <Label>Nueva estación</Label>
            <Input value={newStation} onChange={(e) => setNewStation(e.target.value)} placeholder="Parrilla, Bebidas, Fríos…" />
          </div>
          <Button onClick={addStation}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        </div>

        {stations.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Aún no hay estaciones. Crea la primera arriba.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stations.map((s) => {
              const printer = printers.find((p) => p.id === s.printer_id);
              return (
                <Card key={s.id} className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ background: s.color ?? "hsl(var(--primary))" }}>
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <Select value={s.printer_id ?? NONE} onValueChange={(v) => updateStationPrinter(s.id, v)}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Sin impresora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin impresora</SelectItem>
                        {printers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.paper_width_mm}mm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {printer && <Badge variant="secondary" className="gap-1"><Printer className="h-3 w-3" />OK</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => removeStation(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <div>
        <h3 className="text-lg font-bold flex items-center gap-2"><Tag className="h-5 w-5" /> Categorías → Estación</h3>
        <p className="text-sm text-muted-foreground">Cada categoría hereda la impresora de su estación. Los productos pueden anular esto en su ficha.</p>
      </div>

      <Card className="p-4">
        {categories.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No hay categorías.</div>
        ) : (
          <div className="divide-y">
            {categories.map((c) => {
              const station = stations.find((s) => s.id === c.kitchen_station_id);
              const printer = station ? printers.find((p) => p.id === station.printer_id) : null;
              return (
                <div key={c.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 font-medium truncate">{c.name}</div>
                  <Select value={c.kitchen_station_id ?? NONE} onValueChange={(v) => updateCategoryStation(c.id, v)}>
                    <SelectTrigger className="w-56 h-8 text-xs">
                      <SelectValue placeholder="Sin estación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin estación</SelectItem>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="min-w-[100px] justify-center text-[10px]">
                    {printer ? printer.name : station ? "sin impresora" : "—"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
