import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a Realtime channel with a unique topic suffix per mount.
 * Evita el error "cannot add 'postgres_changes' callbacks for realtime:<topic>"
 * cuando StrictMode/HMR remontan un hook y supabase.channel(name) devuelve
 * una referencia ya joined.
 *
 * Devuelve { channel, cleanup }. `channel` puede ser null si la suscripción
 * falla — Realtime nunca debe derribar el feature.
 */
export function uniqueTopic(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function safeRemoveChannel(channel: ReturnType<typeof supabase.channel> | null) {
  if (!channel) return;
  try {
    supabase.removeChannel(channel);
  } catch {
    /* noop */
  }
}
