/**
 * ICartRepository — Contrato para persistencia del carrito omnicanal.
 *
 * La capa `presentation/` consume esta interfaz; la implementación concreta
 * (Supabase, memoria in-tests, mock) vive en `src/infrastructure/`.
 *
 * Fase 2 · Adaptadores de Infraestructura.
 */
import type { Cart } from "@/core/domain/entities/Cart";

export interface PersistCartInput {
  readonly cartToken: string;
  readonly cart: Cart;
  readonly subtotal: number;
  readonly totalItems: number;
  readonly phone?: string | null;
  readonly userId?: string | null;
  readonly channel?: "web" | "pos" | "whatsapp";
  readonly metadata?: Record<string, unknown>;
}

export interface RemoteCartRow {
  readonly items: readonly unknown[];
  readonly phone?: string | null;
  readonly subtotal?: number;
}

export interface ICartRepository {
  /** Escribe/actualiza el carrito remoto (fire-and-forget). */
  persist(input: PersistCartInput): Promise<{ error: Error | null }>;

  /** Lee el carrito remoto por token. */
  findByToken(token: string): Promise<RemoteCartRow | null>;

  /** Marca el carrito como completado tras crear la orden. */
  complete(token: string): Promise<{ error: Error | null }>;
}
