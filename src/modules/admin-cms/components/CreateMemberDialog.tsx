/**
 * CreateMemberDialog — crea (o reutiliza) una cuenta de acceso y la asocia
 * al tenant actual con un rol concreto.
 *
 * Resuelve el flujo que faltaba: "quiero que este correo pueda entrar a esta
 * tienda con esta contraseña y este rol", en un solo paso y auditado.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTenantMember,
  suggestPassword,
  ORG_ROLE_LABELS,
  type OrgRole,
} from "../services/tenantAccess";

type Props = {
  organizationId: string;
  organizationName: string;
  /** El owner sólo puede ser asignado por el owner o un superadmin. */
  canAssignOwner?: boolean;
  disabled?: boolean;
  onCreated?: () => void;
};

const ASSIGNABLE: OrgRole[] = ["admin", "manager", "cashier", "waiter", "kitchen", "agent", "member"];

export default function CreateMemberDialog({
  organizationId,
  organizationName,
  canAssignOwner = false,
  disabled,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<OrgRole>("cashier");
  const [password, setPassword] = useState(suggestPassword);
  const [reveal, setReveal] = useState(true);

  const roles = canAssignOwner ? (["owner", ...ASSIGNABLE] as OrgRole[]) : ASSIGNABLE;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwValid = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  const reset = () => {
    setEmail("");
    setFullName("");
    setRole("cashier");
    setPassword(suggestPassword());
  };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await createTenantMember({
        organizationId,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        password,
      });
      toast.success(
        res.reused_existing_account
          ? `Cuenta existente asociada a ${organizationName}`
          : `Acceso creado para ${res.email}`,
      );
      onCreated?.();
      setOpen(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5" disabled={disabled}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Crear acceso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear acceso a {organizationName}</DialogTitle>
          <DialogDescription>
            Si el correo ya tiene cuenta, se reutiliza y sólo se asocia a esta tienda con el rol elegido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tam-email">Correo</Label>
            <Input
              id="tam-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cajero@tienda.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tam-name">Nombre</Label>
            <Input
              id="tam-name"
              className="h-11"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tam-role">Rol en la tienda</Label>
            <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
              <SelectTrigger id="tam-role" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>{ORG_ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tam-pw">Contraseña inicial</Label>
            <div className="flex gap-1.5">
              <Input
                id="tam-pw"
                type={reveal ? "text" : "password"}
                autoComplete="new-password"
                className="h-11 font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="tam-pw-help"
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
                onClick={() => {
                  navigator.clipboard?.writeText(password);
                  toast.success("Contraseña copiada");
                }}
                aria-label="Copiar contraseña"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p id="tam-pw-help" className="text-[11px] text-muted-foreground">
              Mínimo 8 caracteres, con al menos una letra y un número. Cópiala antes de guardar:
              no se vuelve a mostrar.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !emailValid || !pwValid}>
            {saving ? "Creando…" : "Crear acceso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
