import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

/**
 * Omnichannel cart listener.
 *
 * 1. URL handoff: when the user returns from WhatsApp via `?cart=<token>`,
 *    rehydrate the local cart from `persistent_carts`.
 * 2. Realtime: subscribe to changes on the active cart row so a cart edited
 *    inside WhatsApp Flow reflects instantly on the open web tab.
 */
const OmnichannelCartListener = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartToken, hydrateFromRemote } = useCart();
  const handledTokenRef = useRef<string | null>(null);

  // 1) URL token handoff
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incoming = params.get("cart");
    if (!incoming || handledTokenRef.current === incoming) return;
    handledTokenRef.current = incoming;

    (async () => {
      const ok = await hydrateFromRemote(incoming);
      if (ok) toast.success("Carrito recuperado desde WhatsApp");
      // Strip the token from the URL to avoid re-hydration loops
      params.delete("cart");
      const qs = params.toString();
      navigate(
        { pathname: location.pathname, search: qs ? `?${qs}` : "" },
        { replace: true },
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // 2) Realtime sync — listen for changes to the active cart row
  useEffect(() => {
    if (!cartToken) return;
    const channel = supabase
      .channel(`persistent_cart:${cartToken}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "persistent_carts",
          filter: `cart_token=eq.${cartToken}`,
        },
        (payload: any) => {
          const newRow = payload.new;
          // Only re-hydrate when the change came from another channel
          // (e.g. WhatsApp Flow) to avoid feedback loops.
          if (newRow?.channel && newRow.channel !== "web") {
            hydrateFromRemote(cartToken).then((ok) => {
              if (ok) toast.info("Tu carrito se actualizó desde WhatsApp");
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cartToken, hydrateFromRemote]);

  return null;
};

export default OmnichannelCartListener;
