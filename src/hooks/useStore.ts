import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;

/** Returns a Set of inactive brand names (lowercased) to filter products */
export const useInactiveBrands = () =>
  useQuery({
    queryKey: ["inactive-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("name")
        .eq("is_active", false);
      if (error) throw error;
      return new Set((data ?? []).map((b) => b.name.toLowerCase()));
    },
    staleTime: 5 * 60 * 1000,
  });

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

export const useProducts = (categorySlug?: string, search?: string) => {
  const { data: inactiveBrands } = useInactiveBrands();

  return useQuery({
    queryKey: ["products", categorySlug, search, inactiveBrands ? Array.from(inactiveBrands) : []],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories(slug, name)").eq("is_active", true);
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search.toLowerCase()}}`);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      let result = data;
      // Filter out products from inactive brands
      if (inactiveBrands && inactiveBrands.size > 0) {
        result = result.filter((p: any) => !p.brand || !inactiveBrands.has(p.brand.toLowerCase()));
      }
      if (categorySlug) {
        result = result.filter((p: any) => p.categories?.slug === categorySlug);
      }
      return result as (Product & { categories: { slug: string; name: string } | null })[];
    },
    enabled: inactiveBrands !== undefined,
  });
};

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
