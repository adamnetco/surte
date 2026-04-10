import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Check, X, MessageCircle, Eye, EyeOff, Loader2, Search } from "lucide-react";

const CustomerReviewsTab = ({ queryClient }: { queryClient: any }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-customer-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleApproval = async (id: string, approved: boolean) => {
    const { error } = await supabase.from("customer_reviews").update({ is_approved: approved }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(approved ? "Comentario aprobado" : "Comentario ocultado");
    queryClient.invalidateQueries({ queryKey: ["admin-customer-reviews"] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("customer_reviews").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-customer-reviews"] });
  };

  const saveResponse = async (id: string, response: string) => {
    const { error } = await supabase.from("customer_reviews").update({ admin_response: response }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Respuesta guardada");
    queryClient.invalidateQueries({ queryKey: ["admin-customer-reviews"] });
  };

  const filtered = reviews?.filter((r: any) => {
    const matchSearch = !search || r.customer_name.toLowerCase().includes(search.toLowerCase()) || r.comment.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "pending" && !r.is_approved) || (filter === "approved" && r.is_approved);
    return matchSearch && matchFilter;
  });

  const avgRating = reviews?.length ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1) : "0";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Comentarios ({reviews?.length || 0})</h2>
          <p className="text-xs text-muted-foreground">Promedio: ⭐ {avgRating} / 5</p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {(["all", "pending", "approved"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {f === "all" ? "Todos" : f === "pending" ? "Pendientes" : "Aprobados"}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></div>}

      <div className="space-y-3">
        {filtered?.map((review: any) => (
          <ReviewCard key={review.id} review={review} onToggleApproval={toggleApproval} onToggleActive={toggleActive} onSaveResponse={saveResponse} />
        ))}
      </div>

      {filtered?.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <MessageCircle size={32} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin comentarios</p>
        </div>
      )}
    </div>
  );
};

const ReviewCard = ({ review, onToggleApproval, onToggleActive, onSaveResponse }: any) => {
  const [response, setResponse] = useState(review.admin_response || "");
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="bg-card rounded-lg p-4 border border-border space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-semibold text-foreground">{review.customer_name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={12} className={s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">
              {new Date(review.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onToggleApproval(review.id, !review.is_approved)}
            className={`p-1.5 rounded-lg text-xs ${review.is_approved ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}
            title={review.is_approved ? "Ocultar" : "Aprobar"}>
            {review.is_approved ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button onClick={() => onToggleActive(review.id, !review.is_active)}
            className={`p-1.5 rounded-lg text-xs ${review.is_active ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive"}`}>
            {review.is_active ? <Check size={14} /> : <X size={14} />}
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground/80">{review.comment}</p>

      {review.customer_email && <p className="text-[10px] text-muted-foreground">📧 {review.customer_email}</p>}
      {review.customer_phone && <p className="text-[10px] text-muted-foreground">📱 {review.customer_phone}</p>}

      <button onClick={() => setShowResponse(!showResponse)} className="text-xs text-primary font-medium">
        {showResponse ? "Cerrar respuesta" : "Responder"}
      </button>

      {showResponse && (
        <div className="flex gap-1.5">
          <input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Respuesta del admin..." className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={() => onSaveResponse(review.id, response)} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold">Guardar</button>
        </div>
      )}

      {review.admin_response && !showResponse && (
        <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-2">💬 {review.admin_response}</p>
      )}
    </div>
  );
};

export default CustomerReviewsTab;
