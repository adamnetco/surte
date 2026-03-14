import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

export const useProducts = (categorySlug?: string, search?: string) =>
  useQuery({
    queryKey: ["products", categorySlug, search],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories(slug, name)").eq("is_active", true);
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      let result = data;
      if (categorySlug) {
        result = data.filter((p: any) => p.categories?.slug === categorySlug);
      }
      return result as (Product & { categories: { slug: string; name: string } | null })[];
    },
  });

export const useAppSettings = () =>
  useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      const settings: Record<string, string> = {};
      data.forEach((s) => { settings[s.key] = s.value; });
      return settings;
    },
  });
