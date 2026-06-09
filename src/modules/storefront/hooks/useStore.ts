import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;

const PRODUCT_CARD_COLUMNS = [
  "id",
  "name",
  "slug",
  "brand",
  "tags",
  "price",
  "price_wholesale",
  "price_distributor",
  "original_price",
  "stock",
  "image_url",
  "unit",
  "unit_quantity",
  "unit_measure",
  "net_weight_grams",
  "is_fresh",
  "is_wholesale",
  "available_from",
  "available_until",
  "available_days",
  "available_time_start",
  "available_time_end",
].join(",");

const withTimeout = (ms = 3500) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => window.clearTimeout(timeoutId) };
};

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
        .select("id,slug,name,sort_order,meta_title,meta_description,og_image_url")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

/** Returns true if a product is currently available based on its scheduling fields. */
const isProductAvailableNow = (p: any): boolean => {
  const now = new Date();
  if (p.available_from && new Date(p.available_from) > now) return false;
  if (p.available_until && new Date(p.available_until) < now) return false;
  if (Array.isArray(p.available_days) && p.available_days.length > 0) {
    if (!p.available_days.includes(now.getDay())) return false;
  }
  if (p.available_time_start || p.available_time_end) {
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (p.available_time_start && hhmm < String(p.available_time_start).slice(0, 5)) return false;
    if (p.available_time_end && hhmm > String(p.available_time_end).slice(0, 5)) return false;
  }
  return true;
};

export const useProducts = (categorySlug?: string, search?: string) => {
  const { data: inactiveBrands } = useInactiveBrands();

  return useQuery({
    queryKey: ["products", categorySlug, search, inactiveBrands ? Array.from(inactiveBrands) : []],
    queryFn: async () => {
      const categoryJoin = categorySlug ? "categories!inner(slug,name)" : "categories(slug,name)";
      let query = supabase
        .from("products")
        .select(`${PRODUCT_CARD_COLUMNS},${categoryJoin}`)
        .eq("is_active", true);
      if (categorySlug) query = query.eq("categories.slug", categorySlug);
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
      // Filter by scheduling/availability
      result = result.filter((p: any) => isProductAvailableNow(p));
      return result as (Product & { categories: { slug: string; name: string } | null })[];
    },
    enabled: inactiveBrands !== undefined,
    refetchInterval: 5 * 60 * 1000, // re-evaluate scheduling every 5 min
  });
};

export const useAppSettings = (enabled = true) =>
  useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const timeout = withTimeout();
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .abortSignal(timeout.signal);
        if (error) throw error;
        const settings: Record<string, string> = {};
        data.forEach((s) => { settings[s.key] = s.value; });
        return settings;
      } finally {
        timeout.done();
      }
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
