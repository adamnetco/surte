import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  useAddonsCatalog,
  useTenantAddons,
  usePurchaseAddon,
  type Addon,
} from "@/lib/entitlements/useAddons";
import {
  Package, Plus, CreditCard, CheckCircle2, Clock, XCircle,
  ArrowUpRight, Loader2, ShieldCheck,
} from "lucide-react";

const COP = (n: number) => "$" + Math.round(Number(n || 0)).toLocaleString("es-CO");
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PERIOD_LABEL: Record<Addon["billing_period"], string> = {
  one_shot: "Pago único",
  monthly: "Mensual",
  yearly: "Anual",
};

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  active:   { label: "Activo",     cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  pending:  { label: "Pendiente",  cls: "bg-amber-100 text-amber-700",     icon: Clock },
  expired:  { label: "Expirado",   cls: "bg-zinc-100 text-zinc-700",       icon: XCircle },
  canceled: { label: "Cancelado",  cls: "bg-zinc-100 text-zinc-600",       icon: XCircle },
  failed:   { label: "Falló",      cls: "bg-rose-100 text-rose-700",       icon: XCircle },
};

export default function BillingAddons() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? null;

  const { data: catalog, isLoading: catLoading } = useAddonsCatalog();
  const { data: tenantAddons, isLoading: taLoading } = useTenantAddons(orgId);
  const purchase = usePurchaseAddon();

  // Suscripción actual para tarjeta de método de pago
  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ["billing-addons", "subscription", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, plan, status, payment_method_brand, payment_method_last4, current_period_end")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const activeAddonCodes = useMemo(
    () => new Set((tenantAddons ?? []).filter(a => a.status === "active").map(a => a.addon_code)),
    [tenantAddons],
  );

  const handlePurchase = (addon: Addon) => {
    if (!orgId) return;
    purchase.mutate(
      { organization_id: orgId, addon },
      {
        onSuccess: () => toast({ title: "Redirigiendo a Wompi", description: "Completa el pago en la nueva pestaña." }),
        onError: (e: any) => toast({ title: "No se pudo iniciar el pago", description: e?.message ?? "Inténtalo de nuevo.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add-ons y método de pago</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Amplía las capacidades de tu plan y gestiona la tarjeta con la que cobramos tus suscripciones.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/billing/overview">Ver consumo</Link>
        </Button>
      </header>

      {/* MÉTODO DE PAGO */}
      <section>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">Método de pago</h2>
        <Card className="p-5 border-border/60">
          {subLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : sub ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  {sub.payment_method_brand && sub.payment_method_last4 ? (
                    <>
                      <p className="font-medium capitalize">
                        {sub.payment_method_brand} ···· {sub.payment_method_last4}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <ShieldCheck className="h-3 w-3" />
                        Próximo cobro {fmtDate(sub.current_period_end)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">No hay tarjeta registrada</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Te pediremos el método de pago al activar tu próximo plan.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/billing/plan">
                  Actualizar tarjeta
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tienes una suscripción activa.</p>
          )}
        </Card>
      </section>

      {/* MIS ADD-ONS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Mis add-ons</h2>
          {tenantAddons && tenantAddons.length > 0 && (
            <span className="text-xs text-muted-foreground">{tenantAddons.length} registro(s)</span>
          )}
        </div>
        {taLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !tenantAddons || tenantAddons.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
            Aún no has contratado add-ons. Explora el catálogo abajo.
          </Card>
        ) : (
          <div className="space-y-2">
            {tenantAddons.map(ta => {
              const meta = catalog?.find(c => c.code === ta.addon_code);
              const badge = STATUS_BADGE[ta.status] ?? STATUS_BADGE.pending;
              const Icon = badge.icon;
              return (
                <Card key={ta.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-md bg-muted p-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{meta?.name ?? ta.addon_code}</p>
                      <p className="text-xs text-muted-foreground">
                        Activado {fmtDate(ta.starts_at)}
                        {ta.ends_at ? ` · vence ${fmtDate(ta.ends_at)}` : ""}
                        {ta.quantity > 1 ? ` · x${ta.quantity}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ta.amount_paid_cop != null && (
                      <span className="text-sm text-muted-foreground">{COP(ta.amount_paid_cop)}</span>
                    )}
                    <Badge className={`${badge.cls} border-0 gap-1`}>
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* CATÁLOGO */}
      <section>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">Catálogo de add-ons</h2>
        {catLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : !catalog || catalog.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
            No hay add-ons disponibles por ahora.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {catalog.map(addon => {
              const isActive = activeAddonCodes.has(addon.code);
              const busy = purchase.isPending && purchase.variables?.addon.code === addon.code;
              return (
                <Card key={addon.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{addon.name}</h3>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {PERIOD_LABEL[addon.billing_period]}
                      </Badge>
                    </div>
                    <p className="text-right">
                      <span className="text-lg font-bold">{COP(addon.price_cop)}</span>
                      <span className="block text-xs text-muted-foreground">COP</span>
                    </p>
                  </div>
                  {addon.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{addon.description}</p>
                  )}
                  <div className="mt-auto pt-1">
                    {isActive ? (
                      <Button variant="outline" disabled className="w-full">
                        <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                        Ya activo
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handlePurchase(addon)}
                        disabled={busy || !orgId}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1.5" />
                        )}
                        Contratar
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
