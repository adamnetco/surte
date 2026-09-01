/**
 * memberCredentials — adaptador de infraestructura para la gestión de
 * credenciales de miembros de un tenant.
 *
 * Encapsula la llamada a la edge function `admin-reset-password` para que la
 * capa de presentación no conozca el backend.
 */
import { supabase } from "@/integrations/supabase/client";

export type ResetPasswordInput = {
  targetUserId: string;
  organizationId: string;
};

export type ResetPasswordResult = {
  maskedEmail: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "No tienes permiso para restablecer esta contraseña.",
  forbidden_owner_target: "Solo el owner puede restablecer la contraseña del owner.",
  target_not_in_org: "El usuario no pertenece a esta tienda.",
  target_email_not_found: "El usuario no tiene un correo válido registrado.",
  synthetic_email_no_reset:
    "Esta cuenta usa un correo interno sin buzón: no puede recibir el enlace de restablecimiento.",
  reset_send_failed: "No se pudo enviar el correo. Intenta de nuevo en unos minutos.",
};

export async function requestMemberPasswordReset(
  input: ResetPasswordInput,
): Promise<ResetPasswordResult> {
  const { data, error } = await supabase.functions.invoke("admin-reset-password", {
    body: {
      target_user_id: input.targetUserId,
      organization_id: input.organizationId,
      redirect_to: `${window.location.origin}/reset-password`,
    },
  });

  const payload = (data ?? {}) as { ok?: boolean; masked_email?: string; error?: string; code?: string };

  if (error || !payload.ok) {
    const key = payload.code || payload.error || "";
    throw new Error(ERROR_MESSAGES[key] ?? payload.error ?? error?.message ?? "Error inesperado");
  }

  return { maskedEmail: payload.masked_email ?? "el correo registrado" };
}
