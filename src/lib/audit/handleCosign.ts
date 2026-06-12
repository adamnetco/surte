import { toast } from "sonner";
import { CosignRequiredError } from "./auditedMutation";

/**
 * Maneja errores comunes de `auditedMutation()`.
 * - Si requiere co-firma, muestra toast con CTA a la cola.
 * - Si es otro error, lanza un toast.error.
 * Devuelve `true` si fue manejado (no propagar).
 */
export function handleAuditError(err: unknown): boolean {
  if (err instanceof CosignRequiredError) {
    toast.warning("Acción enviada a co-firma", {
      description: "Otro superadmin debe aprobarla antes de ejecutarse.",
      action: {
        label: "Ver cola",
        onClick: () => {
          window.location.href = "/superadmin/acciones-criticas";
        },
      },
      duration: 8000,
    });
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(msg || "Error desconocido");
  return true;
}
