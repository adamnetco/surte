import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, ExternalLink } from "lucide-react";
import { useAppSettings } from "@/hooks/useStore";
import { motion } from "framer-motion";

const GoogleReviewsDisplay = () => {
  const { data: settings } = useAppSettings();
  const googleMapsUrl = settings?.google_maps_url;

  const { data: reviews } = useQuery({
    queryKey: ["google-reviews-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_reviews")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (!reviews?.length) return null;

  const avgRating = (reviews.reduce((sum, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-6 px-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-base text-foreground">Reseñas de Google</h2>
          <p className="text-xs text-muted-foreground">⭐ {avgRating} · {reviews.length} reseñas</p>
        </div>
        {googleMapsUrl && (
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
            <Star size={12} /> Dejar reseña
          </a>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {reviews.map((review: any) => (
          <div key={review.id} className="shrink-0 w-[260px] bg-card rounded-xl p-4 border border-border space-y-2">
            <div className="flex items-center gap-2">
              {review.profile_photo_url ? (
                <img src={review.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {review.author_name.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{review.author_name}</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={10} className={s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
                  ))}
                </div>
              </div>
            </div>
            {review.review_text && (
              <p className="text-xs text-foreground/80 line-clamp-4">{review.review_text}</p>
            )}
          </div>
        ))}
      </div>

      {googleMapsUrl && (
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline">
          <ExternalLink size={12} /> Ver todas en Google Maps
        </a>
      )}
    </motion.section>
  );
};

export default GoogleReviewsDisplay;
