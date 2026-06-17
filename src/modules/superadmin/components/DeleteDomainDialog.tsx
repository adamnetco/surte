import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: {
    id: string;
    hostname: string;
    organization_id: string;
    cf_hostname_id?: string | null;
  } | null;
  /** Si el dominio pertenece a otra org distinta a la seleccionada. */
  isForeign?: boolean;
  onDeleted: () => void;
}

export default function DeleteDomainDialog({
  open,
  onOpenChange,
  domain,
  isForeign = false,
  onDeleted,
}: DeleteDomainDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setTyped(""); setBusy(false); };

  const handleConfirm = async () => {
    if (!domain) return;
    if (typed.trim().toLowerCase() !== domain.hostname) {
      toast.error("El hostname no coincide");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-tenant-domain", {
        body: { domain_id: domain.id, confirm_hostname: typed.trim().toLowerCase() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        (data as any)?.cloudflare_purged
          ? `Dominio eliminado y Cloudflare purgado`
          : `Dominio eliminado (sin recursos Cloudflare)`,
      );
      onDeleted();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar dominio");
    } finally {
      setBusy(false);
    }
  };

  const matches = !!domain && typed.trim().toLowerCase() === domain.hostname;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Eliminar dominio
            {isForeign && (
              <Badge variant="destructive" className="ml-2">⚠ Foráneo</Badge>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Esta acción <strong>elimina permanentemente</strong> el dominio{" "}
                <code className="font-mono bg-muted px-1 rounded">{domain?.hostname}</code> y
                purga el recurso en Cloudflare si existe.
              </p>
              {isForeign && (
                <p className="text-destructive">
                  Este dominio pertenece a una organización distinta a la seleccionada en el scope.
                  La acción quedará registrada en el audit log con tu identidad.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="confirm-hostname">
                  Escribe <code className="font-mono">{domain?.hostname}</code> para confirmar:
                </Label>
                <Input
                  id="confirm-hostname"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={domain?.hostname}
                  autoComplete="off"
                  data-testid="delete-domain-confirm-input"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={!matches || busy}
            data-testid="delete-domain-confirm-btn"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Eliminando…" : "Eliminar definitivamente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
