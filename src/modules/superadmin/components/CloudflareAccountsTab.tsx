import { useState } from "react";
import { Plus, Trash2, Star, Cloud, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  loadCfAccounts,
  saveCfAccount,
  deleteCfAccount,
  maskToken,
  type CloudflareAccount,
} from "@/modules/superadmin/lib/cloudflareDrafts";

interface Props {
  orgId: string;
}

const empty = (orgId: string): Partial<CloudflareAccount> & { api_token?: string } => ({
  organization_id: orgId,
  label: "",
  cf_account_id: "",
  cf_zone_id: "",
  api_token: "",
  is_default: false,
});

/**
 * /superadmin/sitios?tab=cloudflare — CRUD para `tenant_cloudflare_accounts`.
 * Persiste en localStorage hasta que la migración corra. El token completo
 * NO se guarda en LS (solo enmascarado); cuando Cloud responda se cifrará
 * con `AUTH_ENCRYPTION_KEY` y se almacenará en la columna `api_token_encrypted`.
 */
export default function CloudflareAccountsTab({ orgId }: Props) {
  const [accounts, setAccounts] = useState<CloudflareAccount[]>(() => loadCfAccounts(orgId));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => empty(orgId));
  const [showToken, setShowToken] = useState(false);

  const refresh = () => setAccounts(loadCfAccounts(orgId));

  const submit = () => {
    if (!form.label?.trim()) return toast.error("Etiqueta requerida");
    if (!form.cf_account_id?.trim()) return toast.error("Cloudflare Account ID requerido");
    if (!form.api_token?.trim() || form.api_token.length < 20) {
      return toast.error("API token inválido (mínimo 20 caracteres)");
    }
    const account: CloudflareAccount = {
      id: crypto.randomUUID(),
      organization_id: orgId,
      label: form.label.trim(),
      cf_account_id: form.cf_account_id.trim(),
      cf_zone_id: form.cf_zone_id?.trim() || undefined,
      api_token_masked: maskToken(form.api_token),
      is_default: !!form.is_default,
      created_at: new Date().toISOString(),
    };
    saveCfAccount(account);
    toast.success("Cuenta guardada (borrador local)");
    setOpen(false);
    setForm(empty(orgId));
    setShowToken(false);
    refresh();
  };

  const remove = (id: string) => {
    if (!window.confirm("¿Eliminar esta cuenta Cloudflare?")) return;
    deleteCfAccount(id);
    refresh();
    toast.success("Eliminada");
  };

  const setDefault = (a: CloudflareAccount) => {
    saveCfAccount({ ...a, is_default: true });
    refresh();
    toast.success(`"${a.label}" ahora es la cuenta por defecto`);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
        <strong>Modo borrador:</strong> los tokens completos se guardarán cifrados en la tabla{" "}
        <code>tenant_cloudflare_accounts</code> cuando Lovable Cloud vuelva. Por ahora solo se
        persiste una versión enmascarada localmente.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Cloud size={16} className="text-primary" /> Cuentas Cloudflare
          </h3>
          <p className="text-xs text-muted-foreground">
            {accounts.length} cuenta{accounts.length === 1 ? "" : "s"} configurada
            {accounts.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowToken(false); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Añadir cuenta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva cuenta Cloudflare</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Etiqueta *</Label>
                <Input
                  value={form.label ?? ""}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Cuenta Surteya"
                />
              </div>
              <div>
                <Label>Cloudflare Account ID *</Label>
                <Input
                  value={form.cf_account_id ?? ""}
                  onChange={(e) => setForm({ ...form, cf_account_id: e.target.value })}
                  placeholder="32 caracteres hex"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Dashboard CF → Workers & Pages → Overview → Account ID.
                </p>
              </div>
              <div>
                <Label>Zone ID (opcional)</Label>
                <Input
                  value={form.cf_zone_id ?? ""}
                  onChange={(e) => setForm({ ...form, cf_zone_id: e.target.value })}
                  placeholder="Solo si esta cuenta tiene una zona fija"
                />
              </div>
              <div>
                <Label>API Token *</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={form.api_token ?? ""}
                    onChange={(e) => setForm({ ...form, api_token: e.target.value })}
                    placeholder="scope: Zone.SSL + Zone.Hostname + Zone.DNS"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Solo se guardará enmascarado hasta que el backend vuelva. Asegúrate de poder
                  pegarlo de nuevo después.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Usar como cuenta por defecto para esta organización
              </label>
              <Button onClick={submit} className="w-full">Guardar cuenta</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etiqueta</TableHead>
            <TableHead>Account ID</TableHead>
            <TableHead>Zone ID</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>Por defecto</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Aún no hay cuentas Cloudflare. Se usará la cuenta SaaS por defecto.
              </TableCell>
            </TableRow>
          )}
          {accounts.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.label}</TableCell>
              <TableCell className="font-mono text-xs">{a.cf_account_id.slice(0, 12)}…</TableCell>
              <TableCell className="font-mono text-xs">{a.cf_zone_id ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{a.api_token_masked}</TableCell>
              <TableCell>
                {a.is_default ? (
                  <Badge className="bg-primary text-primary-foreground"><Star size={10} className="mr-1" />Sí</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setDefault(a)}>Marcar</Button>
                )}
              </TableCell>
              <TableCell>
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
