import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, X, MapPin, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CITIES = ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];

const ShippingTab = ({ queryClient }: { queryClient: any }) => {
  const { data: zones } = useQuery({
    queryKey: ["admin-shipping-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_zones").select("*").order("city").order("neighborhood");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ city: "Bucaramanga", neighborhood: "", delivery_price: "" });
  const [filterCity, setFilterCity] = useState("");
  const [search, setSearch] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const save = async () => {
    if (!form.neighborhood) { toast.error("Barrio es obligatorio"); return; }
    const payload = { city: form.city, neighborhood: form.neighborhood.trim(), delivery_price: Number(form.delivery_price) || 0, is_active: true };
    if (editing && editing !== "new") {
      const { error } = await supabase.from("shipping_zones").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("shipping_zones").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Zona guardada");
    queryClient.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    queryClient.invalidateQueries({ queryKey: ["shipping-zones"] });
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar zona?")) return;
    await supabase.from("shipping_zones").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    toast.success("Zona eliminada");
  };

  const bulkImport = async () => {
    const lines = bulkText.split("\n").filter(l => l.trim());
    let count = 0;
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map(s => s.trim());
      if (parts.length < 2) continue;
      const [city, neighborhood, price] = parts;
      if (!CITIES.some(c => c.toLowerCase() === city.toLowerCase())) continue;
      await supabase.from("shipping_zones").insert({
        city: CITIES.find(c => c.toLowerCase() === city.toLowerCase()) || city,
        neighborhood,
        delivery_price: Number(price) || 0,
      });
      count++;
    }
    toast.success(`${count} zonas importadas`);
    queryClient.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    setShowBulk(false);
    setBulkText("");
  };

  const filtered = zones?.filter(z => {
    if (filterCity && z.city !== filterCity) return false;
    if (search && !z.neighborhood.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg text-foreground">Zonas de Envío</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(!showBulk)} className="text-xs px-3 py-2 bg-muted rounded-lg flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Upload size={14} /> CSV
          </button>
          <button onClick={() => { setForm({ city: "Bucaramanga", neighborhood: "", delivery_price: "" }); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
            <Plus size={14} /> Nueva
          </button>
        </div>
      </div>

      {/* Bulk import */}
      {showBulk && (
        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <p className="text-xs text-muted-foreground">Formato: <code className="bg-muted px-1 rounded">Ciudad, Barrio, Precio</code> (una línea por zona)</p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder="Bucaramanga, Cabecera, 5000&#10;Floridablanca, Cañaveral, 6000" className="w-full bg-muted rounded-lg px-3 py-2 text-sm font-mono border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <div className="flex gap-2">
            <button onClick={() => setShowBulk(false)} className="flex-1 bg-muted rounded-lg py-2 text-sm text-muted-foreground">Cancelar</button>
            <button onClick={bulkImport} className="flex-1 btn-surte py-2 text-sm flex items-center justify-center gap-1"><Upload size={14} /> Importar</button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <div className="flex justify-between">
            <span className="font-heading font-semibold text-sm">{editing === "new" ? "Nueva" : "Editar"} Zona</span>
            <button onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors">
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Barrio *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input type="number" value={form.delivery_price} onChange={(e) => setForm({ ...form, delivery_price: e.target.value })} placeholder="Precio domicilio (COP)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <button onClick={save} className="btn-surte w-full text-sm py-2.5 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors">
          <option value="">Todas las ciudades</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar barrio..." className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
      </div>

      {/* Zones list */}
      <div className="space-y-2">
        {filtered?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No hay zonas configuradas</p>}
        {filtered?.map((z: any) => (
          <div key={z.id} className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
            <MapPin size={16} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{z.neighborhood}</p>
              <p className="text-xs text-muted-foreground">{z.city}</p>
            </div>
            <span className="text-sm font-heading font-bold text-foreground">
              {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(z.delivery_price)}
            </span>
            <button onClick={() => { setForm({ city: z.city, neighborhood: z.neighborhood, delivery_price: String(z.delivery_price) }); setEditing(z.id); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <Save size={14} />
            </button>
            <button onClick={() => del(z.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {zones?.length || 0} zonas en total · Área Metropolitana de Bucaramanga
      </p>
    </div>
  );
};

export default ShippingTab;
