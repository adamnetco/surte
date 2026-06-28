import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsageMeter } from "@/components/billing/UsageMeter";
import {
  CreditCard, Calendar, ArrowUpRight, FileText, Package, Zap, AlertCircle,
} from "lucide-react";

const COP = (n: number) => "$" + Math.round(Number(n || 0)).toLocaleString("es-CO");

// Labels legibles para limit_keys conocidos. Si no hay match, se usa el key crudo.
const LIMIT_LABELS: Record<string, { label: string; unit?: string }> = {
  max_users: { label: "Usuarios" },
  max_locations: { label: "Sucursales" },
  max_products: { label: "Productos" },
  max_invoices_monthly: { label: "Facturas / mes" },
  max_einvoices_monthly: { label: "Facturas electrónicas / mes" },
  max_pos_terminals: { label: "Terminales POS" },
  storage_mb: { label: "Almacenamiento", unit: "MB" },
  api_calls_monthly: { label: "Llamadas API / mes" },
  whatsapp_messages_monthly: { label: "Mensajes WhatsApp / mes" },
};

type Overview = {
  subscription: any | null;
  plan: any | null;
  usage: Array<{
    limit_key: string;
    limit_value: number | null;
    used: number;
    remaining: number | null;
    pct: number;
    source: "plan" | "override";
  }>;
  addons: Array<{
    addon_code: string;
    quantity: number;
    starts_at: string;
    ends_at: string | null;
    name: string | null;
    description: string | null;
  }>;
  resolved_at: string;
};

const STATUS_TONE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  active:    { variant: "default",     label: "Activa" },
  trialing:  { variant: "secondary",   label: "Período de prueba" },
  trial:     { variant: "secondary",   label: "Período de prueba" },
  past_due:  { variant: "destructive", label: "Pago pendiente" },
  paused:    { variant: "outline",     label: "Pausada" },
  canceled:  { variant: "outline",     label: "Cancelada" },
  pending:   { variant: "secondary",   label: "Pendiente" },
};

export default function BillingOverview() {
  const { currentOrg } = useOrganization();

  useEffect(() => { document.title = "Mi suscripción · SistecPOS"; }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-overview", currentOrg?.id],
    enabled: !!currentOrg?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<Overview> => {
      const { data, error } = await (supabase as any).rpc("get_billing_overview", { p_org_id: currentOrg!.id });
      if (error) throw error;
      return data as Overview;
    },
  });

  if (!currentOrg) {
    return <div className="max-w-7xl mx-auto p-6">Selecciona una organización para ver tu suscripción.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <CreditCard className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">Mi suscripción</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Resumen de tu plan</h1>
          <p className="text-sm text-muted-foreground">
            Estado, consumo y add-ons de <span className="font-medium">{currentOrg.name}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/billing"><FileText className="h-4 w-4 mr-1" /> Facturas</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/planes">Cambiar plan <ArrowUpRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
      </header>

      {isLoading && <OverviewSkeleton />}

      {error && (
        <Card className="p-4 border-l-4 border-l-destructive bg-destructive/5">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-sm">No pudimos cargar tu suscripción</p>
              <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
            </div>
          </div>
        </Card>
      )}

      {data && (
        <>
          {/* Plan + estado */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan actual</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <h2 className="text-2xl font-bold">{data.plan?.name ?? "Sin plan"}</h2>
                  {data.subscription && (
                    <Badge variant={STATUS_TONE[data.subscription.status]?.variant ?? "secondary"}>
                      {STATUS_TONE[data.subscription.status]?.label ?? data.subscription.status}
                    </Badge>
                  )}
                  {data.subscription?.cancel_at_period_end && (
                    <Badge variant="outline" className="text-destructive border-destructive/30">
                      Se cancelará al fin del periodo
                    </Badge>
                  )}
                </div>
                {data.plan && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {Number(data.plan.price_monthly) === 0 ? "Gratis" : `${COP(data.plan.price_monthly)} / mes`}
                  </p>
                )}
              </div>
              <div className="text-sm space-y-1 text-right">
                {data.subscription?.trial_ends_at && (
                  <p className="text-muted-foreground flex items-center gap-1 justify-end">
                    <Calendar className="h-3 w-3" /> Trial hasta {new Date(data.subscription.trial_ends_at).toLocaleDateString("es-CO")}
                  </p>
                )}
                {data.subscription?.current_period_end && (
                  <p className="text-muted-foreground flex items-center gap-1 justify-end">
                    <Calendar className="h-3 w-3" /> Próximo cobro {new Date(data.subscription.current_period_end).toLocaleDateString("es-CO")}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Uso vs límites */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Consumo del plan</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Actualizado {new Date(data.resolved_at).toLocaleTimeString("es-CO")}
              </span>
            </div>
            {data.usage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tu plan no tiene límites configurados.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {data.usage.map((u) => {
                  const meta = LIMIT_LABELS[u.limit_key] ?? { label: u.limit_key };
                  return (
                    <UsageMeter
                      key={u.limit_key}
                      label={meta.label}
                      used={u.used}
                      limit={u.limit_value}
                      pct={u.pct}
                      source={u.source}
                      unit={meta.unit}
                    />
                  );
                })}
              </div>
            )}
          </Card>

          {/* Add-ons activos */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Add-ons activos</h3>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/planes#addons">Explorar add-ons <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
            {data.addons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes add-ons contratados.</p>
            ) : (
              <ul className="space-y-2">
                {data.addons.map((a) => (
                  <li key={a.addon_code} className="flex items-center justify-between border rounded-md p-3 gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{a.name ?? a.addon_code}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <p>x{a.quantity}</p>
                      {a.ends_at && <p>hasta {new Date(a.ends_at).toLocaleDateString("es-CO")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="p-5"><Skeleton className="h-24 w-full" /></Card>
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </Card>
      <Card className="p-5"><Skeleton className="h-20 w-full" /></Card>
    </div>
  );
}
