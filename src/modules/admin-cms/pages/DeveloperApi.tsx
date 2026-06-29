import { useEffect, useState } from "react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Code2, Key, Plus, Trash2, Webhook, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const ALL_EVENTS = [
  "order.created",
  "order.paid",
  "order.cancelled",
  "invoice.emitted",
  "invoice.accepted",
  "invoice.rejected",
  "product.created",
  "product.updated",
  "stock.low",
  "customer.created",
];

export default function DeveloperApiPage() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const [tab, setTab] = useState<"keys" | "webhooks" | "deliveries">("keys");
  const [keys, setKeys] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<{ name: string; scopes: string[] }>({ name: "", scopes: ["pos_orders:read"] });
  const [newKeyResult, setNewKeyResult] = useState<{ prefix: string; secret: string } | null>(null);
  const [newWh, setNewWh] = useState<{ url: string; events: string[]; description: string }>({ url: "", events: [], description: "" });
  const [showWhDialog, setShowWhDialog] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const [k, e, d] = await Promise.all([
      supabase.from("api_keys").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("webhook_endpoints").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("webhook_deliveries").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys(k.data ?? []);
    setEndpoints(e.data ?? []);
    setDeliveries(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  const createKey = async () => {
    if (!orgId || !newKey.name.trim()) return;
    const { data, error } = await supabase.rpc("create_api_key", {
      p_org: orgId,
      p_name: newKey.name,
      p_scopes: newKey.scopes,
    });
    if (error) return toast.error("No se pudo crear", { description: error.message });
    setNewKeyResult({ prefix: (data as any).prefix, secret: (data as any).secret });
    setNewKey({ name: "", scopes: ["pos_orders:read"] });
    load();
  };

  const revokeKey = async (id: string) => {
    if (!confirm("¿Revocar esta clave? No podrá deshacerse.")) return;
    const { error } = await supabase.rpc("revoke_api_key", { p_id: id });
    if (error) return toast.error(error.message);
    toast.success("Clave revocada");
    load();
  };

  const createEndpoint = async () => {
    if (!orgId || !newWh.url.trim()) return;
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("webhook_endpoints").insert({
      organization_id: orgId,
      url: newWh.url.trim(),
      secret,
      events: newWh.events.length ? newWh.events : ["*"],
      description: newWh.description || null,
    });
    if (error) return toast.error("No se pudo crear", { description: error.message });
    setNewWh({ url: "", events: [], description: "" });
    setShowWhDialog(false);
    toast.success("Endpoint creado");
    load();
  };

  const toggleEndpoint = async (id: string, active: boolean) => {
    await supabase.from("webhook_endpoints").update({ is_active: active }).eq("id", id);
    load();
  };

  const deleteEndpoint = async (id: string) => {
    if (!confirm("¿Eliminar este endpoint? También se borrarán sus envíos.")) return;
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    toast.success("Endpoint eliminado");
    load();
  };

  const copy = (txt: string, label = "Copiado") => {
    navigator.clipboard.writeText(txt);
    toast.success(label);
  };

  if (!orgId) {
    return <div className="p-6 text-sm text-muted-foreground">Selecciona una organización.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Code2 className="h-6 w-6" /> API &amp; Webhooks
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecta tu ERP, sitio o integraciones con tokens y webhooks firmados HMAC.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b">
        {[
          { k: "keys", label: "API keys", icon: Key },
          { k: "webhooks", label: "Webhooks", icon: Webhook },
          { k: "deliveries", label: "Envíos recientes", icon: Clock },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${
                tab === t.k ? "border-primary font-medium" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "keys" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear nueva API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <Label>Nombre</Label>
                <Input
                  value={newKey.name}
                  onChange={(e) => setNewKey((s) => ({ ...s, name: e.target.value }))}
                  placeholder="ERP producción"
                />
              </div>
              <div>
                <Label>Scopes</Label>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 md:grid-cols-3">
                  {[
                    "pos_orders:read",
                    "pos_orders:write",
                    "einvoices:read",
                    "einvoices:write",
                    "products:read",
                    "*",
                  ].map((sc) => (
                    <label key={sc} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={newKey.scopes.includes(sc)}
                        onChange={(e) => setNewKey((s) => ({
                          ...s,
                          scopes: e.target.checked ? [...s.scopes, sc] : s.scopes.filter((x) => x !== sc),
                        }))}
                      />
                      <code>{sc}</code>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={createKey} disabled={!newKey.name.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Crear
              </Button>
            </div>

            <div className="rounded-lg border">
              {loading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : keys.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Sin claves aún.</p>
              ) : (
                <ul className="divide-y">
                  {keys.map((k) => (
                    <li key={k.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{k.name}</span>
                          {k.revoked_at ? <Badge variant="destructive">Revocada</Badge> : <Badge>Activa</Badge>}
                        </div>
                        <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {k.scopes?.join(", ")} · {k.last_used_at ? `usada ${new Date(k.last_used_at).toLocaleDateString()}` : "sin uso"}
                        </span>
                      </div>
                      {!k.revoked_at && (
                        <Button size="sm" variant="ghost" onClick={() => revokeKey(k.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "webhooks" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Endpoints</CardTitle>
            <Button size="sm" onClick={() => setShowWhDialog(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nuevo endpoint
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : endpoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin endpoints. Crea uno para recibir eventos en tu servidor (POST firmado HMAC-SHA256).
              </p>
            ) : (
              <ul className="space-y-3">
                {endpoints.map((e) => (
                  <li key={e.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code className="break-all text-sm">{e.url}</code>
                      <div className="flex items-center gap-2">
                        <Switch checked={e.is_active} onCheckedChange={(v) => toggleEndpoint(e.id, v)} />
                        <Button size="sm" variant="ghost" onClick={() => deleteEndpoint(e.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(e.events ?? []).map((ev: string) => (
                        <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Secret:</span>
                      <code className="rounded bg-muted px-1">{e.secret.slice(0, 12)}…</code>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(e.secret, "Secret copiado")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      {e.consecutive_failures > 0 && (
                        <Badge variant="destructive" className="ml-auto">{e.consecutive_failures} fallos</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "deliveries" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos 50 envíos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin envíos aún.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                    {d.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : d.status === "dead" || d.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                    <code className="text-xs">{d.event_type}</code>
                    <Badge variant="outline" className="text-xs">{d.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      intento {d.attempt_count} {d.last_status_code ? `· ${d.last_status_code}` : ""}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("es-CO")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reveal new key once */}
      <Dialog open={!!newKeyResult} onOpenChange={(o) => !o && setNewKeyResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clave creada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta es la única vez que verás el secreto completo. Cópialo y guárdalo en tu gestor de credenciales.
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-xs">
            <code className="flex-1 break-all">{newKeyResult?.secret}</code>
            <Button size="sm" variant="ghost" onClick={() => newKeyResult && copy(newKeyResult.secret, "Clave copiada")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyResult(null)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New webhook dialog */}
      <Dialog open={showWhDialog} onOpenChange={setShowWhDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo endpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>URL HTTPS</Label>
              <Input
                value={newWh.url}
                onChange={(e) => setNewWh((s) => ({ ...s, url: e.target.value }))}
                placeholder="https://mi-erp.com/webhooks/sistecpos"
              />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Input
                value={newWh.description}
                onChange={(e) => setNewWh((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Eventos (vacío = todos)</Label>
              <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newWh.events.includes(ev)}
                      onChange={(e) => setNewWh((s) => ({
                        ...s,
                        events: e.target.checked ? [...s.events, ev] : s.events.filter((x) => x !== ev),
                      }))}
                    />
                    <code className="text-xs">{ev}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWhDialog(false)}>Cancelar</Button>
            <Button onClick={createEndpoint} disabled={!newWh.url.trim().startsWith("https://")}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
