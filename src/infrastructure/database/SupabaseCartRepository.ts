/**
 * SupabaseCartRepository — Implementa `ICartRepository` usando el client
 * de Supabase (RPCs `upsert_persistent_cart`, `get_persistent_cart`,
 * `complete_persistent_cart`).
 *
 * Reglas:
 *  - Fire-and-forget: nunca lanza; devuelve `{ error }` para que la UI decida.
 *  - No transforma el dominio → asume que quien llama ya calculó los items.
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ICartRepository,
  PersistCartInput,
  RemoteCartRow,
} from "@/core/ports/ICartRepository";

const asError = (raw: unknown): Error | null =>
  raw ? new Error((raw as { message?: string }).message ?? "cart_persist_failed") : null;

export const supabaseCartRepository: ICartRepository = {
  async persist(input: PersistCartInput) {
    const items = input.cart.lines.map((l) => ({
      product_id: l.productId,
      name: l.name,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      line_total: l.unitPrice * l.quantity,
      presentation_id: l.presentationId ?? null,
    }));

    const { error } = await supabase.rpc("upsert_persistent_cart", {
      _cart_token: input.cartToken,
      _items: items as unknown as never,
      _subtotal: input.subtotal,
      _total_items: input.totalItems,
      _phone: input.phone ?? null,
      _user_id: input.userId ?? null,
      _channel: input.channel ?? "web",
      _metadata: (input.metadata ?? {}) as unknown as never,
    });
    return { error: asError(error) };
  },

  async findByToken(token: string): Promise<RemoteCartRow | null> {
    const { data, error } = await supabase.rpc("get_persistent_cart", {
      _cart_token: token,
    });
    if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
    const row = (Array.isArray(data) ? data[0] : data) as {
      items?: unknown[];
      phone?: string | null;
      subtotal?: number;
    };
    return {
      items: Array.isArray(row.items) ? row.items : [],
      phone: row.phone ?? null,
      subtotal: row.subtotal,
    };
  },

  async complete(token: string) {
    const { error } = await supabase.rpc("complete_persistent_cart", {
      _cart_token: token,
    });
    return { error: asError(error) };
  },
};
