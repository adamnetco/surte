import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "@/hooks/use-toast";
import { ArrowDownRight, ArrowUpRight, Check, Loader2, Sparkles } from "lucide-react";

type Plan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  modules: string[];
  trial_days: number;
  sort_order: number | null;
};

type Subscription = {
  id: string;
  plan: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
};

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3, enterprise: 4 };

export default function BillingPlan() {
  const { currentOrg } = useOrganization();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    document.title = "Plan y facturación · SistecPOS";
  }, []);

  useEffect(() => {
    if (!currentOrg?.id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [pl, sb] = await Promise.all([
        supabase.from("saas_plans").select("*").eq("is_public", true).order("sort_order"),
        supabase
          .from("subscriptions")
          .select("id, plan, status, billing_cycle, current_period_end, cancel_at_period_end, trial_ends_at")
          .eq("organization_id", currentOrg.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!mounted) return;
      setPlans(((pl.data as any) ?? []) as Plan[]);
      setSub((sb.data as any) ?? null);
      if (sb.data?.billing_cycle === "yearly" || sb.data?.billing_cycle === "monthly") {
        setCycle(sb.data.billing_cycle);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [currentOrg?.id]);

  const currentPlanKey = sub?.plan ?? "free";
  const currentRank = PLAN_RANK[currentPlanKey] ?? 0;

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [plans],
  );

  async function startCheckout(planKey: string) {
    if (!currentOrg?.id) return;
    setCheckoutKey(planKey);
    try {
      const returnUrl = `${window.location.origin}/billing/plan?from=wompi`;
      const { data, error } = await supabase.functions.invoke("wompi-create-subscription", {
        body: {
          organization_id: currentOrg.id,
          plan_key: planKey,
          billing_cycle: cycle,
          return_url: returnUrl,
        },
      });
      if (error) throw error;
      const url = (data as any)?.checkout_url;
      if (!url) throw new Error("No se obtuvo la URL de checkout.");
      window.location.href = url;
    } catch (e: any) {
      console.error("[BillingPlan] checkout", e);
      toast({ title: "No fue posible iniciar el pago", description: e.message, variant: "destructive" });
      setCheckoutKey(null);
    }
  }

  async function toggleCancel(cancel: boolean) {
    if (!currentOrg?.id) return;
    setCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc("set_subscription_cancel_at_period_end" as any, {
        p_org_id: currentOrg.id,
        p_cancel: cancel,
      });
      if (error) throw error;
      setSub((s) =>
        s ? { ...s, cancel_at_period_end: (data as any)?.cancel_at_period_end ?? cancel } : s,
      );
      toast({
        title: cancel ? "Cancelación programada" : "Renovación reactivada",
        description: cancel
          ? `Tu plan seguirá activo hasta ${fmtDate(sub?.current_period_end ?? null)}.`
          : "Tu suscripción se renovará automáticamente al fin de periodo.",
      });
    } catch (e: any) {
      console.error("[BillingPlan] cancel toggle", e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCancelBusy(false);
      setConfirmCancel(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  const activeBadge: Record<string, { label: string; cls: string }> = {
    active: { label: "Activa", cls: "bg-emerald-100 text-emerald-700" },
    trialing: { label: "En prueba", cls: "bg-blue-100 text-blue-700" },
    past_due: { label: "Pago vencido", cls: "bg-amber-100 text-amber-700" },
    canceled: { label: "Cancelada", cls: "bg-muted text-foreground/70" },
    paused: { label: "Pausada", cls: "bg-muted text-foreground/70" },
    pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700" },
  };
  const badge = activeBadge[sub?.status ?? "pending"] ?? activeBadge.pending;

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Plan y facturación</h1>
          <p className="text-sm text-muted-foreground">
            Cambia tu plan, ajusta el ciclo de facturación o cancela cuando quieras.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Button variant="outline" asChild>
            <Link to="/billing/overview">Uso y límites</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/billing/invoices">Facturas</Link>
          </Button>
        </div>
      </header>

      {/* Suscripción actual */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="font-heading font-bold text-lg capitalize">
                Plan {currentPlanKey}
              </h2>
              <Badge className={badge.cls}>{badge.label}</Badge>
              {sub?.cancel_at_period_end && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  Cancela al fin de periodo
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Ciclo: <span className="font-medium capitalize">{sub?.billing_cycle ?? "—"}</span>
              {" · "}
              Próximo cobro: <span className="font-medium">{fmtDate(sub?.current_period_end ?? null)}</span>
              {sub?.trial_ends_at && (
                <>
                  {" · "}
                  Prueba hasta: <span className="font-medium">{fmtDate(sub.trial_ends_at)}</span>
                </>
              )}
            </p>
          </div>

          {sub && ["active", "trialing", "past_due"].includes(sub.status) && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Renovación automática</span>
              <Switch
                checked={!sub.cancel_at_period_end}
                disabled={cancelBusy}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    // route through retention flow instead of cancelling silently
                    window.location.href = "/billing/cancel";
                  } else toggleCancel(false);
                }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Toggle ciclo */}
      <div className="flex items-center justify-center gap-3 text-sm">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-md border ${cycle === "monthly" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
          onClick={() => setCycle("monthly")}
        >
          Mensual
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-md border ${cycle === "yearly" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
          onClick={() => setCycle("yearly")}
        >
          Anual <span className="ml-1 text-xs opacity-80">-2 meses</span>
        </button>
      </div>

      {/* Grid de planes */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedPlans.map((p) => {
          const rank = PLAN_RANK[p.key] ?? 0;
          const isCurrent = p.key === currentPlanKey;
          const isUpgrade = rank > currentRank;
          const isDowngrade = rank < currentRank;
          const price = cycle === "yearly" ? p.price_yearly : p.price_monthly;
          const busy = checkoutKey === p.key;

          return (
            <Card
              key={p.id}
              className={`p-5 flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary/30" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-bold text-lg">{p.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                </div>
                {isCurrent && <Badge className="bg-primary text-primary-foreground">Actual</Badge>}
              </div>

              <div className="my-4">
                <div className="text-3xl font-bold">{price > 0 ? COP(price) : "Gratis"}</div>
                {price > 0 && (
                  <div className="text-xs text-muted-foreground">
                    / {cycle === "yearly" ? "año" : "mes"}
                  </div>
                )}
              </div>

              <ul className="space-y-1.5 text-sm flex-1">
                {(p.modules ?? []).slice(0, 6).map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span className="capitalize">{m.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">
                    Plan actual
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isUpgrade ? "default" : "outline"}
                    disabled={busy || price === 0}
                    onClick={() => startCheckout(p.key)}
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isUpgrade ? (
                      <>
                        <ArrowUpRight size={14} /> Mejorar a {p.name}
                      </>
                    ) : isDowngrade ? (
                      <>
                        <ArrowDownRight size={14} /> Cambiar a {p.name}
                      </>
                    ) : (
                      "Seleccionar"
                    )}
                  </Button>
                )}
                {isDowngrade && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    El cambio aplica al iniciar el próximo periodo de facturación.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar tu suscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              Conservarás acceso al plan <strong className="capitalize">{currentPlanKey}</strong> hasta el{" "}
              <strong>{fmtDate(sub?.current_period_end ?? null)}</strong>. Después de esa fecha no se realizará
              un nuevo cobro y tu acceso quedará limitado al plan gratuito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelBusy}
              onClick={(e) => {
                e.preventDefault();
                toggleCancel(true);
              }}
            >
              {cancelBusy ? <Loader2 size={14} className="animate-spin" /> : "Sí, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
