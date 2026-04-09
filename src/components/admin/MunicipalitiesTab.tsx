import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, X, MapPin, Pencil, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const MunicipalitiesTab = ({ queryClient }: { queryClient: any }) => {
  const { data: municipalities, isLoading } = useQuery({
    queryKey: ["admin-municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("municipality_settings").select("*").order("city");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ city: "", min_order_amount: "40000", is_active: true });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-municipalities"] });
    queryClient.invalidateQueries({ queryKey: ["municipalities"] });
  };

  const save = async () => {
    if (!form.city.trim()) { toast.error("Ciudad es obligatoria"); return; }
    const payload = { city: form.city.trim(), min_order_amount: Number(form.min_order_amount) || 40000, is_active: form.is_active };

    if (editing && editing !== "new") {
      const { error } = await supabase.from("municipality_settings").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
      toast.success("Municipio actualizado");
    } else {
      const { error } = await supabase.from("municipality_settings").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Municipio creado");
    }
    invalidate();
    setEditing(null);
    setForm({ city: "", min_order_amount: "40000", is_active: true });
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar municipio?")) return;
    const { error } = await supabase.from("municipality_settings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
    toast.success("Municipio eliminado");
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("municipality_settings").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(!current ? "Municipio activo" : "Municipio oculto");
    invalidate();
  };

  const copyUrl = (city: string) => {
    navigator.clipboard.writeText(`https://surteya.com/hub/ciudad/${city.toLowerCase()}`);
    toast.success("URL copiada");
  };

  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
  const activeCount = municipalities?.filter(m => m.is_active).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Municipios</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activos</span> · {(municipalities?.length || 0) - activeCount} ocultos
          </p>
        </div>
        <button onClick={() => { setForm({ city: "", min_order_amount: "40000", is_active: true }); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {editing && (
        <div className="bg-card rounded-xl p-4 border border-accent/30 space-y-3">
          <div className="flex justify-between">
            <span className="font-heading font-semibold text-sm text-foreground">{editing === "new" ? "Nuevo" : "Editar"} Municipio</span>
            <button onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Nombre del municipio *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input type="number" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} placeholder="Pedido mínimo (COP)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-sm">{form.is_active ? "Activo" : "Inactivo"}</span>
          </div>
          <button onClick={save} className="btn-surte w-full text-sm py-2.5 flex items-center justify-center gap-1">
            <Save size={14} /> Guardar
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>}
      <div className="space-y-2">
        {municipalities?.length === 0 && !isLoading && <p className="text-sm text-muted-foreground text-center py-6">No hay municipios configurados</p>}
        {municipalities?.map((m: any) => (
          <div key={m.id} className={`flex items-center gap-3 bg-card rounded-xl p-3 border border-border transition-opacity ${!m.is_active ? "opacity-50" : ""}`}>
            <MapPin size={16} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">{m.city}</p>
                {!m.is_active && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">OCULTO</span>}
              </div>
              <p className="text-xs text-muted-foreground">Mín. {fmt.format(m.min_order_amount)}</p>
            </div>
            <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m.id, m.is_active)} />
            <button onClick={() => copyUrl(m.city)} className="text-muted-foreground hover:text-primary transition-colors p-1" title="Copiar URL"><LinkIcon size={14} /></button>
            <a href={`/hub/ciudad/${m.city.toLowerCase()}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1" title="Ver página"><ExternalLink size={14} /></a>
            <button onClick={() => { setForm({ city: m.city, min_order_amount: String(m.min_order_amount), is_active: m.is_active }); setEditing(m.id); }} className="text-muted-foreground hover:text-foreground transition-colors p-1"><Pencil size={14} /></button>
            <button onClick={() => del(m.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MunicipalitiesTab;
