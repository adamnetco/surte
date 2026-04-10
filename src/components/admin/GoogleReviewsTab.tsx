import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";

const GoogleReviewsTab = ({ queryClient }: { queryClient: any }) => {
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ author_name: "", rating: 5, review_text: "", profile_photo_url: "" });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-google-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_reviews")
        .select("*")
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
    if (!form.author_name.trim()) { toast.error("Nombre es obligatorio"); return; }
    const payload = {
      author_name: form.author_name,
      rating: form.rating,
      review_text: form.review_text || null,
      profile_photo_url: form.profile_photo_url || null,
    };

    if (editing) {
      const { error } = await supabase.from("google_reviews").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Reseña actualizada");
    } else {
      const { error } = await supabase.from("google_reviews").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Reseña agregada");
    }
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["admin-google-reviews"] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("google_reviews").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-google-reviews"] });
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm("¿Eliminar esta reseña?")) return;
    const { error } = await supabase.from("google_reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reseña eliminada");
    queryClient.invalidateQueries({ queryKey: ["admin-google-reviews"] });
  };

  const startEdit = (r: any) => {
    setEditing(r);
    setForm({ author_name: r.author_name, rating: r.rating, review_text: r.review_text || "", profile_photo_url: r.profile_photo_url || "" });
  };

  return (
    <div>
      <h2 className="font-heading font-bold text-lg text-foreground mb-4">Reseñas Google ({reviews?.length || 0})</h2>
      <p className="text-xs text-muted-foreground mb-4">Agrega manualmente las reseñas de Google My Business que quieras mostrar en la tienda.</p>

      {/* Form */}
      <div className="bg-card rounded-lg p-4 border border-border space-y-3 mb-4">
        <h3 className="text-sm font-semibold">{editing ? "Editar reseña" : "Agregar reseña"}</h3>
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

      {isLoading && <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></div>}

      <div className="space-y-3">
        {reviews?.map((r: any) => (
          <div key={r.id} className={`bg-card rounded-lg p-4 border border-border space-y-2 ${!r.is_active ? "opacity-50" : ""}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {r.profile_photo_url && <img src={r.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />}
                <div>
                  <p className="text-sm font-semibold">{r.author_name}</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={10} className={s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => toggleActive(r.id, !r.is_active)} className="p-1.5 rounded-lg bg-muted">
                  {r.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg bg-muted text-primary text-xs font-semibold">Editar</button>
                <button onClick={() => deleteReview(r.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {r.review_text && <p className="text-sm text-foreground/80">{r.review_text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoogleReviewsTab;
