import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import TiptapEditor from "@/modules/admin-cms/components/TiptapEditor";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { scopedFrom } from "@/modules/tenant/lib/tenantScope";

type EntityType = "category" | "brand" | "city" | "tag";
type Faq = { q: string; a: string };

interface Row {
  id?: string;
  entity_type: EntityType;
  entity_slug: string;
  city_scope: string | null;
  heading: string | null;
  body_html: string | null;
  faqs: Faq[];
  is_active: boolean;
  sort_order: number;
}

const empty: Row = {
  entity_type: "category",
  entity_slug: "",
  city_scope: null,
  heading: "",
  body_html: "",
  faqs: [],
  is_active: true,
  sort_order: 0,
};

const SeoContentTab = ({ queryClient }: { queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const [editing, setEditing] = useState<Row | null>(null);
  const [filter, setFilter] = useState<EntityType | "all">("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["seo_content_admin", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await scopedFrom("seo_content", orgId)
        .order("entity_type")
        .order("entity_slug");
      if (error) throw error;
      return data as any as Row[];
    },
  });

  const filtered = (rows || []).filter((r) => filter === "all" || r.entity_type === filter);

  const save = async () => {
    if (!editing) return;
    if (!orgId) return toast.error("Selecciona una organización");
    if (!editing.entity_slug.trim()) return toast.error("Slug requerido");
    const payload: any = {
      entity_type: editing.entity_type,
      entity_slug: editing.entity_slug.trim(),
      city_scope: editing.city_scope?.trim() || null,
      heading: editing.heading || null,
      body_html: editing.body_html || null,
      faqs: editing.faqs || [],
      is_active: editing.is_active,
      sort_order: editing.sort_order || 0,
      organization_id: orgId,
    };
    const q = editing.id
      ? supabase.from("seo_content").update(payload).eq("id", editing.id).eq("organization_id", orgId)
      : supabase.from("seo_content").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Contenido SEO guardado");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["seo_content_admin", orgId] });
  };

  const remove = async (id: string) => {
    if (!orgId) return;
    if (!window.confirm("¿Eliminar este bloque SEO?")) return;
    const { error } = await supabase.from("seo_content").delete().eq("id", id).eq("organization_id", orgId);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    queryClient.invalidateQueries({ queryKey: ["seo_content_admin", orgId] });
  };

  const updateFaq = (i: number, field: keyof Faq, value: string) => {
    if (!editing) return;
    const faqs = [...(editing.faqs || [])];
    faqs[i] = { ...faqs[i], [field]: value };
    setEditing({ ...editing, faqs });
  };

  const addFaq = () => editing && setEditing({ ...editing, faqs: [...(editing.faqs || []), { q: "", a: "" }] });
  const removeFaq = (i: number) =>
    editing && setEditing({ ...editing, faqs: (editing.faqs || []).filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-heading font-bold flex items-center gap-2">
            <FileText size={18} className="text-accent" /> Contenido SEO largo
          </h2>
          <p className="text-xs text-muted-foreground">Bloques H2 + descripción rica + FAQ por categoría, marca, ciudad o etiqueta.</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="bg-accent text-accent-foreground px-3 py-1.5 rounded-full text-sm font-bold inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Nuevo bloque
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "category", "brand", "city", "tag"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
            }`}
          >
            {t === "all" ? "Todos" : t === "category" ? "Categorías" : t === "brand" ? "Marcas" : t === "city" ? "Ciudades" : "Etiquetas"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite" aria-label="Cargando bloques SEO">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-16 rounded" />
                  <Skeleton className="h-3.5 w-40 rounded" />
                </div>
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No hay bloques SEO aún. Crea el primero.</p>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                    {r.entity_type}
                  </span>
                  <span className="text-sm font-semibold truncate">{r.entity_slug}</span>
                  {r.city_scope && (
                    <span className="text-[10px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded">
                      📍 {r.city_scope}
                    </span>
                  )}
                  {!r.is_active && <span className="text-[10px] text-muted-foreground">(oculto)</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.heading || "Sin H2"}</p>
              </div>
              <button onClick={() => setEditing(r)} className="p-2 text-muted-foreground hover:text-primary"><Pencil size={16} /></button>
              <button onClick={() => r.id && remove(r.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-heading font-bold">{editing.id ? "Editar bloque SEO" : "Nuevo bloque SEO"}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-muted rounded-full"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="block mb-1 font-medium">Tipo</span>
                  <select
                    value={editing.entity_type}
                    onChange={(e) => setEditing({ ...editing, entity_type: e.target.value as EntityType })}
                    className="w-full px-2 py-1.5 rounded border border-border bg-background"
                  >
                    <option value="category">Categoría</option>
                    <option value="brand">Marca</option>
                    <option value="city">Ciudad</option>
                    <option value="tag">Etiqueta</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block mb-1 font-medium">Slug</span>
                  <input
                    value={editing.entity_slug}
                    onChange={(e) => setEditing({ ...editing, entity_slug: e.target.value })}
                    placeholder="ej: mi-categoria"
                    className="w-full px-2 py-1.5 rounded border border-border bg-background"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="block mb-1 font-medium">Ciudad (opcional)</span>
                  <input
                    value={editing.city_scope || ""}
                    onChange={(e) => setEditing({ ...editing, city_scope: e.target.value })}
                    placeholder="bucaramanga"
                    className="w-full px-2 py-1.5 rounded border border-border bg-background"
                  />
                </label>
                <label className="text-xs">
                  <span className="block mb-1 font-medium">Orden</span>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 rounded border border-border bg-background"
                  />
                </label>
              </div>
              <label className="text-xs block">
                <span className="block mb-1 font-medium">Encabezado H2</span>
                <input
                  value={editing.heading || ""}
                  onChange={(e) => setEditing({ ...editing, heading: e.target.value })}
                  placeholder="Encabezado optimizado para SEO"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background"
                />
              </label>
              <div className="text-xs">
                <span className="block mb-1 font-medium">Descripción rica</span>
                <TiptapEditor
                  content={editing.body_html || ""}
                  onChange={(html) => setEditing({ ...editing, body_html: html })}
                  placeholder="Describe el producto/categoría/ciudad para SEO long-tail..."
                />
              </div>
              <div className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">FAQs propias</span>
                  <button onClick={addFaq} className="text-accent inline-flex items-center gap-1"><Plus size={12} /> añadir</button>
                </div>
                <div className="space-y-2">
                  {(editing.faqs || []).map((f, i) => (
                    <div key={i} className="border border-border rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          value={f.q}
                          onChange={(e) => updateFaq(i, "q", e.target.value)}
                          placeholder="Pregunta"
                          className="flex-1 px-2 py-1 rounded border border-border bg-background"
                        />
                        <button onClick={() => removeFaq(i)} className="text-destructive p-1"><Trash2 size={12} /></button>
                      </div>
                      <textarea
                        value={f.a}
                        onChange={(e) => updateFaq(i, "a", e.target.value)}
                        placeholder="Respuesta"
                        rows={2}
                        className="w-full px-2 py-1 rounded border border-border bg-background"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Activo (visible en frontend)
              </label>
            </div>
            <div className="p-4 border-t border-border flex gap-2 sticky bottom-0 bg-card">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2 rounded-full border border-border text-sm font-medium">
                Cancelar
              </button>
              <button onClick={save} className="flex-1 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-bold inline-flex items-center justify-center gap-1.5">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeoContentTab;
