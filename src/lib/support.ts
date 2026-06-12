import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_NUMBER = "573001234567";
const DEFAULT_MESSAGE = "Hola, necesito ayuda con mi tienda en SistecPOS.";

export interface SupportContact {
  number: string;
  message: string;
  waUrl: (customMessage?: string) => string;
}

/**
 * Lee el WhatsApp de soporte global desde `app_settings` (organization_id IS NULL).
 * Keys:
 *   - `support_whatsapp_number`  (E.164 sin +, ej: 573001234567)
 *   - `support_whatsapp_message` (opcional)
 */
export function useSupportContact(): SupportContact {
  const { data } = useQuery({
    queryKey: ["support-contact"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", ["support_whatsapp_number", "support_whatsapp_message"])
        .is("organization_id", null);
      if (error) throw error;
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      return {
        number: sanitize(map.support_whatsapp_number) || DEFAULT_NUMBER,
        message: (map.support_whatsapp_message as string) || DEFAULT_MESSAGE,
      };
    },
  });

  const number = data?.number ?? DEFAULT_NUMBER;
  const message = data?.message ?? DEFAULT_MESSAGE;

  return {
    number,
    message,
    waUrl: (customMessage?: string) =>
      `https://wa.me/${number}?text=${encodeURIComponent(customMessage ?? message)}`,
  };
}

function sanitize(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\D/g, "");
}
