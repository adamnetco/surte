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
import { Plus, Trash2, GripVertical, Save, Pencil, Eye, EyeOff, ExternalLink, Copy, Link } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

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

const getHubUrl = (s: FeaturedSection) => {
  if (s.filter_type === "category" && s.filter_value) return `/hub/categoria/${s.filter_value}`;
  if (s.filter_type === "tag" && s.filter_value) return `/hub/etiqueta/${s.filter_value}`;
  if (s.filter_type === "offers") return `/ofertas`;
  if (s.filter_type === "fresh") return `/hub/etiqueta/fresco`;
  if (s.filter_type === "wholesale") return `/hub/etiqueta/mayorista`;
  return null;
};

const FeaturedSectionsTab = ({ queryClient }: { queryClient: QueryClient }) => {
  const { currentOrg } = useOrganization();
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

  // Fetch products to show match count
  const { data: products } = useQuery({
    queryKey: ["admin-products-for-sections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, tags, is_fresh, is_wholesale, original_price, price, categories(slug)").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const countMatches = (s: FeaturedSection) => {
    if (!products) return 0;
    const val = s.filter_value?.trim().toLowerCase() || "";
    switch (s.filter_type) {
      case "offers": return products.filter((p: any) => p.original_price && p.original_price > p.price).length;
      case "wholesale": return products.filter((p: any) => p.is_wholesale).length;
      case "fresh": return products.filter((p: any) => p.is_fresh).length;
      case "category": return products.filter((p: any) => p.categories?.slug?.toLowerCase() === val).length;
      case "tag": return products.filter((p: any) => p.tags?.some((t: string) => t.toLowerCase().trim() === val || t.toLowerCase().trim().includes(val))).length;
      case "combo": return products.filter((p: any) => p.tags?.some((t: string) => ["combo", "pack", "kit"].includes(t.toLowerCase()))).length;
      default: return 0;
    }
  };

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
      if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
      const { error } = await supabase.from("featured_sections").insert({
        label: section.label,
        emoji: section.emoji || "⭐",
        filter_type: section.filter_type || "tag",
        filter_value: section.filter_value || null,
        sort_order: sections.length,
        is_active: section.is_active ?? true,
        organization_id: currentOrg.id,
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
    // Optimistic update
    queryClient.setQueryData(["featured_sections"], (old: FeaturedSection[] | undefined) =>
      old?.map(s => s.id === id ? { ...s, is_active: !current } : s)
    );
    const { error } = await supabase.from("featured_sections").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ["featured_sections"] });
      return;
    }
    toast.success(!current ? "Sección visible" : "Sección oculta");
  };

  const copyUrl = (s: FeaturedSection) => {
    const url = getHubUrl(s);
    if (url) {
      navigator.clipboard.writeText(`https://surteya.com${url}`);
      toast.success("URL copiada");
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Cargando…</div>;

  const activeCount = sections.filter(s => s.is_active).length;
  const inactiveCount = sections.length - activeCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold">Secciones Destacadas</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activas</span> · {inactiveCount} ocultas
          </p>
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
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              <span className="text-sm">{editing.is_active ? "Visible" : "Oculta"}</span>
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
        {sections.map((s) => {
          const hubUrl = getHubUrl(s);
          return (
            <Card key={s.id} className={`p-3 flex items-center gap-3 transition-opacity ${!s.is_active ? "opacity-50" : ""}`}>
              <GripVertical size={14} className="text-muted-foreground shrink-0" />
              <span className="text-lg">{s.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{s.label}</p>
                  {!s.is_active && (
                    <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">OCULTA</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {FILTER_TYPES.find((f) => f.value === s.filter_type)?.label}
                  {s.filter_value ? ` → ${s.filter_value}` : ""}
                  <span className={`ml-1.5 font-semibold ${countMatches(s) > 0 ? "text-accent" : "text-destructive"}`}>
                    ({countMatches(s)} productos)
                  </span>
                </p>
              </div>
              <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
              {hubUrl && (
                <>
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                    <a href={hubUrl} target="_blank" rel="noopener noreferrer" title="Ver página">
                      <ExternalLink size={13} />
                    </a>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyUrl(s)} title="Copiar URL">
                    <Link size={13} />
                  </Button>
                </>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(s)}>
                <Pencil size={13} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                <Trash2 size={13} />
              </Button>
            </Card>
          );
        })}
        {sections.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No hay secciones creadas aún</p>
        )}
      </div>
    </div>
  );
};

export default FeaturedSectionsTab;
