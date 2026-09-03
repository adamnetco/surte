import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Store,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useTiendaPlus } from "@/modules/admin-cms/hooks/useTiendaPlus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canManageConnection,
  connectionReadiness,
} from "@/core/use-cases/integrations/tiendaPlus";

/**
 * Tienda Plus (Admin) — conector de doble vía con la tienda online.
 *
 * Capa de presentación: toda la lógica vive en `core/use-cases/integrations`
 * y en el puerto `ITiendaPlusRepository`.
 */

type Busy = "none" | "save" | "ping" | "push" | "pullCatalog" | "pullOrders" | "flags";

const SCOPE_LABEL: Record<string, string> = {
  catalog: "Catálogo",
  sales: "Pedidos",
  payments: "Cobros",
};

export default function TiendaPlusAdmin() {
  const { currentOrg, loading: orgLoading } = useOrganization();
  const { role } = useAuth();
  const orgId = currentOrg?.id ?? null;
  const { connection, log, loading, reload, repo } = useTiendaPlus(orgId);

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<Busy>("none");

  const readiness = useMemo(() => connectionReadiness(connection), [connection]);
  const canManage = canManageConnection(connection, role);
  const effectiveBase = baseUrl || connection?.base_url || "https://tiendasysbopos.lovable.app";

  const run = async (kind: Busy, fn: () => Promise<{ ok: boolean; error?: string; unsupported?: boolean }>, okMsg: string) => {
    if (!orgId) return;
    setBusy(kind);
    try {
      const res = await fn();
      if (res.unsupported) {
        toast.warning("Tienda Plus aún no publica ese endpoint", {
          description: "La llave es válida, pero la tienda solo expone cobros por ahora.",
        });
      } else if (res.ok) {
        toast.success(okMsg);
      } else {
        toast.error("No se pudo completar", { description: res.error ?? "Error desconocido" });
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("none");
    }
  };

  if (orgLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AdminHeader />
        <div className="mx-auto max-w-7xl space-y-4 p-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AdminHeader />
      <main className="mx-auto max-w-7xl space-y-4 p-4">
        {/* Estado */}
        <Card className="rounded-lg border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">
                  {connection?.company_name ?? "Sin conectar"}
                </h2>
                {readiness.active ? (
                  <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Activa</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Inactiva</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{effectiveBase}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(connection?.scopes ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">Sin permisos verificados</span>
                )}
                {(connection?.scopes ?? []).map((s) => (
                  <Badge key={s} variant="outline">{SCOPE_LABEL[s] ?? s}</Badge>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              disabled={busy !== "none" || !connection?.api_key_prefix}
              onClick={() => void run("ping", () => repo.ping(orgId!), "Conexión verificada")}
            >
              {busy === "ping" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Probar conexión
            </Button>
          </div>

          {readiness.blockedReason && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
              <span>{readiness.blockedReason}</span>
            </div>
          )}
          {connection?.last_error && (
            <p className="mt-2 text-xs text-destructive">Último error: {connection.last_error}</p>
          )}
        </Card>

        {/* Credenciales */}
        <Card className="rounded-lg border-border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4" /> Credenciales de la API pública
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tp-base">URL de Tienda Plus</Label>
              <Input
                id="tp-base"
                className="h-11"
                placeholder="https://tiendasysbopos.lovable.app"
                value={effectiveBase}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-key">Llave x-api-key</Label>
              <Input
                id="tp-key"
                className="h-11 font-mono"
                type="password"
                placeholder={connection?.api_key_prefix ?? "tp_pos_..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                {connection?.api_key_prefix
                  ? `Guardada: ${connection.api_key_prefix}. Escribe una nueva para reemplazarla.`
                  : "La llave se guarda cifrada en el servidor; nunca vuelve al navegador."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              disabled={!canManage || busy !== "none"}
              onClick={() =>
                void run(
                  "save",
                  () => repo.saveCredentials({ organizationId: orgId!, baseUrl: effectiveBase, apiKey: apiKey || undefined }),
                  "Credenciales validadas y guardadas",
                ).then(() => setApiKey(""))
              }
            >
              {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar y validar
            </Button>
          </div>
        </Card>

        {/* Sincronización */}
        <Card className="rounded-lg border-border p-4">
          <h3 className="mb-3 text-sm font-semibold">Sincronización de doble vía</h3>
          <div className="space-y-3">
            {([
              ["enabled", "Integración activa", "Habilita el envío y la descarga de datos."],
              ["sync_catalog", "Catálogo", "Publica productos, precios y existencias en la tienda online."],
              ["sync_orders", "Pedidos", "Descarga los pedidos de la tienda online al POS."],
              ["sync_payments", "Cobros", "Permite cobrar por la pasarela de Tienda Plus."],
            ] as const).map(([key, label, hint]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Switch
                  checked={Boolean(connection?.[key])}
                  disabled={!canManage || busy !== "none"}
                  onCheckedChange={(v) =>
                    void run("flags", () => repo.setFlags(orgId!, { [key]: v }), "Preferencia actualizada")
                  }
                />
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!readiness.canPushCatalog || busy !== "none"}
              onClick={() => void run("push", () => repo.pushCatalog(orgId!), "Catálogo enviado")}
            >
              {busy === "push" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpFromLine className="mr-2 h-4 w-4" />}
              Enviar catálogo
            </Button>
            <Button
              variant="outline"
              disabled={!readiness.canPushCatalog || busy !== "none"}
              onClick={() => void run("pullCatalog", () => repo.pullCatalog(orgId!), "Precios traídos de Tienda Plus")}
            >
              {busy === "pullCatalog" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
              Traer precios
            </Button>
            <Button
              variant="outline"
              disabled={!readiness.canPullOrders || busy !== "none"}
              onClick={() => void run("pullOrders", () => repo.pullOrders(orgId!), "Pedidos importados")}
            >
              {busy === "pullOrders" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
              Importar pedidos
            </Button>
            <Button variant="ghost" onClick={() => void reload()} disabled={busy !== "none"}>
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Última sincronización:{" "}
            {connection?.last_sync_at ? new Date(connection.last_sync_at).toLocaleString("es-CO") : "nunca"}
          </p>
        </Card>

        {/* Bitácora — tarjetas verticales, sin tablas anchas */}
        <Card className="rounded-lg border-border p-4">
          <h3 className="mb-3 text-sm font-semibold">Bitácora</h3>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {log.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.status === "success" ? "default" : entry.status === "error" ? "destructive" : "secondary"}>
                      {entry.status}
                    </Badge>
                    <span className="text-sm font-medium">
                      {entry.direction === "push" ? "Envío" : entry.direction === "pull" ? "Descarga" : "Cobro"} · {entry.entity}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("es-CO")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.items} elementos · {entry.ok_count} ok · {entry.failed_count} con error
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
