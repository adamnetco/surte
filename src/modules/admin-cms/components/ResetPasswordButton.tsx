/**
 * ResetPasswordButton — dispara el envío del correo de restablecimiento de
 * contraseña para un miembro del tenant (superadmin, owner o admin).
 *
 * Componente de presentación puro: recibe props tipadas y delega la acción al
 * caso de uso `requestMemberPasswordReset` (infraestructura desacoplada).
 */
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { requestMemberPasswordReset } from "@/modules/admin-cms/services/memberCredentials";

type Props = {
  targetUserId: string;
  organizationId: string;
  memberLabel: string;
  disabled?: boolean;
};

export default function ResetPasswordButton({
  targetUserId,
  organizationId,
  memberLabel,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const res = await requestMemberPasswordReset({ targetUserId, organizationId });
      toast.success(`Correo de restablecimiento enviado a ${res.maskedEmail}`, {
        position: "top-center",
      });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message, { position: "top-center" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title="Enviar correo de restablecimiento de contraseña"
        aria-label={`Restablecer contraseña de ${memberLabel}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <KeyRound size={11} /> Contraseña
      </button>

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer contraseña</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará un correo con un enlace de un solo uso a{" "}
              <strong>{memberLabel}</strong> para que defina una nueva contraseña.
              Nadie —ni el superadministrador— puede ver la contraseña actual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Enviando…
                </>
              ) : (
                "Enviar correo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
