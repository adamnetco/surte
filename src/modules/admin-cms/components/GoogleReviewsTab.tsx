import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Plus, Trash2, Eye, EyeOff, Loader2, RefreshCw, Download } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { scopedFrom } from "@/modules/tenant/lib/tenantScope";

const GoogleReviewsTab = ({ queryClient }: { queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ author_name: "", rating: 5, review_text: "", profile_photo_url: "" });
  const [syncing, setSyncing] = useState(false);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-google-reviews", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await scopedFrom("google_reviews", orgId)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm({ author_name: "", rating: 5, review_text: "", profile_photo_url: "" });
    setEditing(null);
  };

  const saveReview = async () => {
    if (!orgId) { toast.error("Selecciona una organización"); return; }
    if (!form.author_name.trim()) { toast.error("Nombre es obligatorio"); return; }
    const payload = {
      author_name: form.author_name,
      rating: form.rating,
      review_text: form.review_text || null,
      profile_photo_url: form.profile_photo_url || null,
      organization_id: orgId,
    };

    if (editing) {
      const { error } = await supabase.from("google_reviews").update(payload).eq("id", editing.id).eq("organization_id", orgId);
      if (error) { toast.error(error.message); return; }
      toast.success("Reseña actualizada");
    } else {
      const { error } = await supabase.from("google_reviews").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Reseña agregada");
    }
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["admin-google-reviews", orgId] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("google_reviews").update({ is_active: active }).eq("id", id).eq("organization_id", orgId!);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-google-reviews", orgId] });
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm("¿Eliminar esta reseña?")) return;
    const { error } = await supabase.from("google_reviews").delete().eq("id", id).eq("organization_id", orgId!);
    if (error) { toast.error(error.message); return; }
    toast.success("Reseña eliminada");
    queryClient.invalidateQueries({ queryKey: ["admin-google-reviews", orgId] });
  };


  const startEdit = (r: any) => {
    setEditing(r);
    setForm({ author_name: r.author_name, rating: r.rating, review_text: r.review_text || "", profile_photo_url: r.profile_photo_url || "" });
  };

  const syncFromGoogle = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-google-reviews");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizado: ${data.imported} nuevas, ${data.skipped} existentes`);
      queryClient.invalidateQueries({ queryKey: ["admin-google-reviews"] });
    } catch (err: any) {
      toast.error(err.message || "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Reseñas Google ({reviews?.length || 0})</h2>
          <p className="text-xs text-muted-foreground">Gestiona reseñas de Google My Business. Sincroniza automáticamente o agrega manualmente.</p>
        </div>
        <button
          onClick={syncFromGoogle}
          disabled={syncing}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Sincronizar desde Google
        </button>
      </div>

      {/* Info */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 mb-4">
        <p className="text-[10px] text-muted-foreground">
          💡 Configura tu <strong>google_place_id</strong> en Ajustes → app_settings para sincronizar automáticamente las reseñas de Google Places API.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form */}
        <div className="bg-card rounded-xl p-4 border border-border space-y-3">
          <h3 className="text-sm font-semibold">{editing ? "Editar reseña" : "Agregar reseña manual"}</h3>
          <input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} placeholder="Nombre del autor *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Calificación:</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setForm({ ...form, rating: s })}>
                <Star size={18} className={s <= form.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
              </button>
            ))}
          </div>
          <textarea value={form.review_text} onChange={(e) => setForm({ ...form, review_text: e.target.value })} placeholder="Texto de la reseña" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" rows={3} />
          <input value={form.profile_photo_url} onChange={(e) => setForm({ ...form, profile_photo_url: e.target.value })} placeholder="URL foto de perfil (opcional)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" />
          <div className="flex gap-2">
            {editing && <button onClick={resetForm} className="flex-1 bg-muted rounded-lg py-2.5 text-sm text-muted-foreground">Cancelar</button>}
            <button onClick={saveReview} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold">
              {editing ? "Actualizar" : "Agregar"}
            </button>
          </div>
        </div>

        {/* Reviews list */}
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {isLoading && <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></div>}
          {reviews?.map((r: any) => (
            <div key={r.id} className={`bg-card rounded-xl p-3 border border-border space-y-2 ${!r.is_active ? "opacity-50" : ""}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 min-w-0">
                  {r.profile_photo_url && <img src={r.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{r.author_name}</p>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={10} className={s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleActive(r.id, !r.is_active)} className="p-1.5 rounded-lg bg-muted">
                    {r.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg bg-muted text-primary text-xs font-semibold">Editar</button>
                  <button onClick={() => deleteReview(r.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {r.review_text && <p className="text-xs text-foreground/80 line-clamp-3">{r.review_text}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GoogleReviewsTab;
