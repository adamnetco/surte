import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Globe, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  heading: string | null;
  body_html: string | null;
  city: string | null;
  page_type: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number | null;
}

const emptyPage: Partial<LandingPage> = {
  slug: "", title: "", meta_title: "", meta_description: "", heading: "",
  body_html: "", city: "", page_type: "custom", image_url: "", is_active: true,
};

const LandingPagesTab = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<LandingPage> | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing_pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landing_pages").select("*").order("sort_order");
      if (error) throw error;
      return data as LandingPage[];
    },
  });

  const handleSave = async () => {
    if (!editing?.slug || !editing?.title) {
      toast.error("Slug y título son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug,
        title: editing.title,
        meta_title: editing.meta_title || null,
        meta_description: editing.meta_description || null,
        heading: editing.heading || null,
        body_html: editing.body_html || null,
        city: editing.city || null,
        page_type: editing.page_type || "custom",
        image_url: editing.image_url || null,
        is_active: editing.is_active ?? true,
      };

      if (editing.id) {
        const { error } = await supabase.from("landing_pages").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Página actualizada");
      } else {
        const { error } = await supabase.from("landing_pages").insert(payload);
        if (error) throw error;
        toast.success("Página creada");
      }
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta página?")) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Página eliminada");
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold">Páginas SEO</h2>
          <p className="text-sm text-muted-foreground">Crea páginas optimizadas para keywords y SEO local</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ ...emptyPage })} className="gap-1.5">
          <Plus size={14} /> Nueva Página
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground"><Loader2 className="animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-2">
          {pages?.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border">
              <Globe size={16} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">/s/{p.slug} • {p.page_type}</p>
              </div>
              {p.is_active ? <Eye size={14} className="text-secondary" /> : <EyeOff size={14} className="text-muted-foreground" />}
              <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted rounded-lg"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg"><Trash2 size={14} /></button>
            </div>
          ))}
          {!pages?.length && <p className="text-center py-8 text-sm text-muted-foreground">No hay páginas creadas aún</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Nueva"} Página SEO</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Slug (URL)</label>
                <Input value={editing.slug || ""} onChange={e => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="domicilios-bucaramanga" />
                <p className="text-[10px] text-muted-foreground mt-0.5">surteya.com/s/{editing.slug || "..."}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Domicilios en Bucaramanga" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Meta Título (SEO)</label>
                <Input value={editing.meta_title || ""} onChange={e => setEditing({ ...editing, meta_title: e.target.value })} placeholder="Domicilios de alimentos en Bucaramanga | SURTÉ YA" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Meta Descripción (SEO)</label>
                <Textarea value={editing.meta_description || ""} onChange={e => setEditing({ ...editing, meta_description: e.target.value })} placeholder="Pide alimentos a domicilio en Bucaramanga..." rows={2} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Encabezado H1</label>
                <Input value={editing.heading || ""} onChange={e => setEditing({ ...editing, heading: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Contenido (HTML)</label>
                <Textarea value={editing.body_html || ""} onChange={e => setEditing({ ...editing, body_html: e.target.value })} rows={4} placeholder="<p>Texto descriptivo para SEO...</p>" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <Select value={editing.page_type || "custom"} onValueChange={v => setEditing({ ...editing, page_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizada</SelectItem>
                      <SelectItem value="ciudad">Ciudad</SelectItem>
                      <SelectItem value="categoria">Categoría</SelectItem>
                      <SelectItem value="marca">Marca</SelectItem>
                      <SelectItem value="keyword">Keyword</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ciudad</label>
                  <Input value={editing.city || ""} onChange={e => setEditing({ ...editing, city: e.target.value })} placeholder="Bucaramanga" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Imagen URL</label>
                <Input value={editing.image_url || ""} onChange={e => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={c => setEditing({ ...editing, is_active: c })} />
                <span className="text-sm">Activa</span>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                {editing.id ? "Guardar Cambios" : "Crear Página"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPagesTab;
