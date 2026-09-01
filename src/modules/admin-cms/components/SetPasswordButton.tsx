/**
 * SetPasswordButton — define una contraseña explícita para un miembro del tenant.
 *
 * Complementa a ResetPasswordButton (que envía correo): aquí el admin fija la
 * clave en el momento, imprescindible cuando el POS local no tiene buzón a mano.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setTenantMemberPassword, suggestPassword } from "../services/tenantAccess";

type Props = {
  organizationId: string;
  targetUserId: string;
  memberLabel: string;
  disabled?: boolean;
};

export default function SetPasswordButton({
  organizationId,
  targetUserId,
  memberLabel,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState(suggestPassword);
  const [reveal, setReveal] = useState(true);

  const pwValid = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await setTenantMemberPassword({ organizationId, targetUserId, password });
      toast.success(`Contraseña actualizada para ${res.masked_email ?? memberLabel}`);
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPassword(suggestPassword()); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[11px]"
          disabled={disabled}
          aria-label={`Definir contraseña de ${memberLabel}`}
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Definir clave
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir contraseña</DialogTitle>
          <DialogDescription>
            Fijas la contraseña de <strong>{memberLabel}</strong> ahora mismo. La sesión activa del
            usuario seguirá funcionando hasta que caduque.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="spb-pw">Nueva contraseña</Label>
          <div className="flex gap-1.5">
            <Input
              id="spb-pw"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              className="h-11 font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="spb-pw-help"
            />
            <Button
              type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0"
              onClick={() => setPassword(suggestPassword())}
              aria-label="Generar otra contraseña"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0"
              onClick={() => { navigator.clipboard?.writeText(password); toast.success("Contraseña copiada"); }}
              aria-label="Copiar contraseña"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p id="spb-pw-help" className="text-[11px] text-muted-foreground">
            Mínimo 8 caracteres, con al menos una letra y un número.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !pwValid}>
            {saving ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
