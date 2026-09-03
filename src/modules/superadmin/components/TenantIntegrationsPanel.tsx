import { useMemo, useState } from "react";
import { Loader2, Plug, RefreshCw, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useTiendaPlus } from "@/modules/admin-cms/hooks/useTiendaPlus";
import { connectionReadiness } from "@/core/use-cases/integrations/tiendaPlus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/**
 * Integraciones por tienda (Superadmin).
 *
 * Decide qué tienda queda EXPUESTA para integrarse con Tienda Plus y si el
 * dueño puede autogestionar la conexión (llave, sincronizaciones).
 */
export default function TenantIntegrationsPanel() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? null;
  const { connection, log, loading, reload, repo } = useTiendaPlus(orgId);
  const [busy, setBusy] = useState<string | null>(null);

  const readiness = useMemo(() => connectionReadiness(connection), [connection]);

  const toggle = async (field: "exposed" | "allow_owner_manage", value: boolean) => {
    if (!orgId) return;
    setBusy(field);
    try {
      const res = await repo.setExposure(orgId, { [field]: value });
      if (res.ok) toast.success("Exposición actualizada");
      else toast.error("No se pudo actualizar", { description: res.error });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  if (!currentOrg) return null;
  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-lg font-bold">Integraciones · {currentOrg.name}</h1>
        <p className="text-sm text-muted-foreground">
          Controla qué tiendas pueden conectarse con Tienda Plus y quién administra la conexión.
        </p>
      </div>

      <Card className="rounded-lg border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Store size={18} /></div>
            <div>
              <p className="font-medium">Tienda Plus by SistecPOS</p>
              <p className="text-xs text-muted-foreground">
                {connection?.base_url ?? "https://tiendasysbopos.lovable.app"}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant={readiness.active ? "default" : "secondary"}>
                  {readiness.active ? "Activa" : readiness.configured ? "Configurada" : "Sin llave"}
                </Badge>
                {(connection?.scopes ?? []).map((s) => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium"><Plug size={14} /> Tienda expuesta</p>
              <p className="text-xs text-muted-foreground">
                Habilita el conector de doble vía para esta tienda.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {busy === "exposed" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={Boolean(connection?.exposed)}
                disabled={busy !== null}
                onCheckedChange={(v) => void toggle("exposed", v)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck size={14} /> El dueño puede administrar</p>
              <p className="text-xs text-muted-foreground">
                Permite que el admin de la tienda pegue su llave y controle qué se sincroniza.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {busy === "allow_owner_manage" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={Boolean(connection?.allow_owner_manage)}
                disabled={busy !== null || !connection?.exposed}
                onCheckedChange={(v) => void toggle("allow_owner_manage", v)}
              />
            </div>
          </div>
        </div>

        {readiness.blockedReason && (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            {readiness.blockedReason}
          </p>
        )}
      </Card>

      <Card className="rounded-lg border-border p-4">
        <p className="mb-3 text-sm font-semibold">Últimos movimientos</p>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {log.slice(0, 10).map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={e.status === "success" ? "default" : e.status === "error" ? "destructive" : "secondary"}>
                    {e.status}
                  </Badge>
                  <span className="font-medium">{e.direction} · {e.entity}</span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("es-CO")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
