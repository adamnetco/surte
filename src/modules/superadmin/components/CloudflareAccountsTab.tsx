import { useEffect, useState } from "react";
import { Plus, Trash2, Star, Cloud, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  orgId: string;
}

interface CFAccountRow {
  id: string;
  organization_id: string;
  label: string;
  cf_account_id: string;
  cf_zone_id: string | null;
  is_default: boolean;
  created_at: string;
}

const emptyForm = (orgId: string) => ({
  organization_id: orgId,
  label: "",
  cf_account_id: "",
  cf_zone_id: "",
  api_token: "",
  is_default: false,
});

/**
 * Fase 2 — CRUD para `tenant_cloudflare_accounts` (DB-backed).
 * El api_token se cifra server-side (AES-GCM, AUTH_ENCRYPTION_KEY) en la edge
 * function `cf-accounts-manage` y nunca se devuelve al cliente. Solo se
 * muestra una versión enmascarada del token recién ingresado.
 */
export default function CloudflareAccountsTab({ orgId }: Props) {
  const [accounts, setAccounts] = useState<CFAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(orgId));
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("cf-accounts-manage", {
      body: { action: "list", organization_id: orgId },
    });
    if (error) toast.error(error.message);
    setAccounts(data?.accounts ?? []);
    setLoading(false);
  };

  useEffect(() => { if (orgId) refresh(); }, [orgId]);

  const submit = async () => {
    if (!form.label.trim()) return toast.error("Etiqueta requerida");
    if (!form.cf_account_id.trim()) return toast.error("Cloudflare Account ID requerido");
    if (!form.api_token.trim() || form.api_token.length < 20) {
      return toast.error("API token inválido (mínimo 20 caracteres)");
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("cf-accounts-manage", {
      body: {
        action: "create",
        organization_id: orgId,
        label: form.label.trim(),
        cf_account_id: form.cf_account_id.trim(),
        cf_zone_id: form.cf_zone_id?.trim() || null,
        api_token: form.api_token,
        is_default: form.is_default,
      },
    });
    setBusy(false);
    if (error || data?.error) {
      return toast.error(error?.message ?? data?.error ?? "No se pudo guardar");
    }
    toast.success("Cuenta guardada (token cifrado)");
    setOpen(false);
    setForm(emptyForm(orgId));
    setShowToken(false);
    await refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar esta cuenta Cloudflare?")) return;
    const { error } = await supabase.functions.invoke("cf-accounts-manage", {
      body: { action: "delete", id },
    });
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    await refresh();
  };

  const setDefault = async (a: CFAccountRow) => {
    const { error } = await supabase.functions.invoke("cf-accounts-manage", {
      body: { action: "set_default", id: a.id },
    });
    if (error) return toast.error(error.message);
    toast.success(`"${a.label}" ahora es la cuenta por defecto`);
    await refresh();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Cloud size={16} className="text-primary" /> Cuentas Cloudflare
          </h3>
          <p className="text-xs text-muted-foreground">
            {accounts.length} cuenta{accounts.length === 1 ? "" : "s"} configurada
            {accounts.length === 1 ? "" : "s"} · tokens cifrados con AES-GCM
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
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Cuenta Surteya"
                />
              </div>
              <div>
                <Label>Cloudflare Account ID *</Label>
                <Input
                  value={form.cf_account_id}
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
                  value={form.cf_zone_id}
                  onChange={(e) => setForm({ ...form, cf_zone_id: e.target.value })}
                  placeholder="Solo si esta cuenta tiene una zona fija"
                />
              </div>
              <div>
                <Label>API Token *</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={form.api_token}
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
                  El token se cifrará server-side y solo se podrá usar desde edge functions.
                  Guarda una copia en tu gestor de contraseñas por si necesitas rotarlo.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Usar como cuenta por defecto para esta organización
              </label>
              <Button onClick={submit} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar cuenta
              </Button>
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
            <TableHead>Por defecto</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={`sk-${i}`} aria-busy="true" aria-live="polite">
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-28" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
              <TableCell><Skeleton className="h-6 w-14 rounded-md" /></TableCell>
              <TableCell><Skeleton className="h-7 w-20 rounded-md" /></TableCell>
            </TableRow>
          ))}
          {!loading && accounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Aún no hay cuentas Cloudflare. Se usará la cuenta SaaS por defecto.
              </TableCell>
            </TableRow>
          )}
          {!loading && accounts.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.label}</TableCell>
              <TableCell className="font-mono text-xs">{a.cf_account_id.slice(0, 12)}…</TableCell>
              <TableCell className="font-mono text-xs">{a.cf_zone_id ?? "—"}</TableCell>
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
