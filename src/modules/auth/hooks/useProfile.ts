import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";

export type BusinessType = "detal" | "horeca" | "minimercado" | "distribuidor";

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

/** Returns the best price for the user's business type */
export const getPriceForType = (
  businessType: BusinessType | undefined,
  price: number,
  priceWholesale?: number | null,
  priceDistributor?: number | null,
): number => {
  if (businessType === "distribuidor" && priceDistributor) return priceDistributor;
  if ((businessType === "horeca" || businessType === "minimercado") && priceWholesale) return priceWholesale;
  return price;
};
