import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const GallerySection = () => {
  const { data: gallery } = useQuery({
    queryKey: ["gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery").select("*").eq("is_active", true).order("sort_order").limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (!gallery?.length) return null;

  return (
    <section className="px-4 py-6">
      <h2 className="text-lg font-heading font-bold text-foreground mb-4">Galería</h2>
      <div className="grid grid-cols-3 gap-2">
        {gallery.map((g, i) => (
          <div key={g.id} className={`rounded-xl overflow-hidden bg-muted ${i === 0 ? "col-span-2 row-span-2" : "aspect-square"}`}>
            <img src={g.image_url} alt={g.caption || ""} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
    </section>
  );
};

export default GallerySection;
