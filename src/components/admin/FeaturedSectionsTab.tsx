import { useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";

interface FeaturedSection {
  id: string;
  label: string;
  emoji: string;
  filter_type: string;
  filter_value: string | null;
  sort_order: number;
  is_active: boolean;
}

const FILTER_TYPES = [
  { value: "offers", label: "Productos en oferta" },
  { value: "wholesale", label: "Productos mayoristas" },
  { value: "fresh", label: "Productos frescos" },
  { value: "category", label: "Por categoría (slug)" },
  { value: "tag", label: "Por etiqueta (tag)" },
  { value: "combo", label: "Combos / Packs" },
];

const EMOJI_PRESETS = ["🔥", "💰", "🌿", "📦", "🍽️", "🍔", "🏠", "🛒", "⭐", "🎉", "🥩", "🧃", "💧", "🍕"];

const FeaturedSectionsTab = ({ queryClient }: { queryClient: QueryClient }) => {
  const [editing, setEditing] = useState<FeaturedSection | null>(null);

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["featured_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_sections")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as FeaturedSection[];
    },
  });

  const handleSave = async (section: Partial<FeaturedSection> & { id?: string }) => {
    if (!section.label?.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    if (section.id) {
      const { error } = await supabase
        .from("featured_sections")
        .update({
          label: section.label,
          emoji: section.emoji || "⭐",
          filter_type: section.filter_type || "tag",
          filter_value: section.filter_value || null,
          sort_order: section.sort_order ?? 0,
          is_active: section.is_active ?? true,
        })
        .eq("id", section.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Sección actualizada");
    } else {
      const { error } = await supabase.from("featured_sections").insert({
        label: section.label,
        emoji: section.emoji || "⭐",
        filter_type: section.filter_type || "tag",
        filter_value: section.filter_value || null,
        sort_order: sections.length,
        is_active: true,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Sección creada");
    }
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["featured_sections"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta sección?")) return;
    const { error } = await supabase.from("featured_sections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada");
    queryClient.invalidateQueries({ queryKey: ["featured_sections"] });
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("featured_sections").update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["featured_sections"] });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold">Secciones Destacadas</h2>
          <p className="text-sm text-muted-foreground">Gestiona las pestañas de la sección "Destacados" en la página principal</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ id: "", label: "", emoji: "⭐", filter_type: "tag", filter_value: "", sort_order: sections.length, is_active: true })}>
          <Plus size={14} className="mr-1" /> Nueva
        </Button>
      </div>

      {/* Edit form */}
      {editing && (
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Ej: Restaurantes" />
            </div>
            <div>
              <Label className="text-xs">Emoji</Label>
              <div className="flex gap-1 flex-wrap mt-1">
                {EMOJI_PRESETS.map((e) => (
                  <button key={e} onClick={() => setEditing({ ...editing, emoji: e })}
                    className={`w-8 h-8 rounded text-base flex items-center justify-center border transition-colors ${editing.emoji === e ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de filtro</Label>
              <Select value={editing.filter_type} onValueChange={(v) => setEditing({ ...editing, filter_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(editing.filter_type === "category" || editing.filter_type === "tag") && (
              <div>
                <Label className="text-xs">Valor del filtro</Label>
                <Input value={editing.filter_value || ""} onChange={(e) => setEditing({ ...editing, filter_value: e.target.value })} placeholder={editing.filter_type === "category" ? "slug-categoria" : "nombre-tag"} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Orden</Label>
              <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleSave(editing)}>
              <Save size={14} className="mr-1" /> Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* List */}
      <div className="space-y-2">
        {sections.map((s) => (
          <Card key={s.id} className="p-3 flex items-center gap-3">
            <GripVertical size={14} className="text-muted-foreground shrink-0" />
            <span className="text-lg">{s.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{s.label}</p>
              <p className="text-xs text-muted-foreground">
                {FILTER_TYPES.find((f) => f.value === s.filter_type)?.label}
                {s.filter_value ? ` → ${s.filter_value}` : ""}
              </p>
            </div>
            <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(s)}>
              <Save size={13} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
              <Trash2 size={13} />
            </Button>
          </Card>
        ))}
        {sections.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No hay secciones creadas aún</p>
        )}
      </div>
    </div>
  );
};

export default FeaturedSectionsTab;
