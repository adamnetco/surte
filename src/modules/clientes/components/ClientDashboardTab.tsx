import { useEffect, useState } from "react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, TicketCheck, ShieldCheck, Headphones, AlertTriangle, CheckCircle2 } from "lucide-react";
import { planLabel } from "@/modules/clientes/data/licensePlans";

interface DashboardMetrics {
  activePlan: string | null;
  licenseStatus: string | null;
  expiresAt: string | null;
  supportPlan: string | null;
  openTickets: number;
  pendingPayments: number;
  loading: boolean;
}

interface Props { onRequestSupport?: () => void; }

export default function ClientDashboardTab({ onRequestSupport }: Props = {}) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activePlan: null, licenseStatus: null, expiresAt: null, supportPlan: null,
    openTickets: 0, pendingPayments: 0, loading: true,
  });

  useEffect(() => {
    if (!user) return;
    async function load() {
      const sb = supabase as any;
      const [licRes, ticketRes, payRes, subRes] = await Promise.all([
        sb.from("licenses").select("plan_type, status, expires_at")
          .eq("contact_email", user!.email ?? "").eq("status", "active")
          .order("created_at", { ascending: false }).limit(1),
        sb.from("client_tickets").select("id", { count: "exact", head: true })
          .eq("user_id", user!.id).in("status", ["open", "in_progress"]),
        sb.from("payments").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        sb.from("support_subscriptions").select("plan, status")
          .eq("user_id", user!.id).eq("status", "active").limit(1),
      ]);
      const lic = licRes.data?.[0];
      const sub = subRes.data?.[0];
      setMetrics({
        activePlan: lic?.plan_type ?? null,
        licenseStatus: lic?.status ?? null,
        expiresAt: lic?.expires_at ?? null,
        supportPlan: sub?.plan ?? null,
        openTickets: ticketRes.count ?? 0,
        pendingPayments: payRes.count ?? 0,
        loading: false,
      });
    }
    load();
  }, [user]);

  if (metrics.loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-32" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const accountOk = metrics.pendingPayments === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          Hola, {user?.user_metadata?.full_name?.split(" ")[0] || "Cliente"} 👋
        </h2>
        <p className="text-sm text-muted-foreground">Aquí tienes un resumen rápido de tu cuenta.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plan Activo</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {metrics.activePlan ? (
              <>
                <p className="text-2xl font-bold">{planLabel(metrics.activePlan)}</p>
                {metrics.expiresAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vence: {new Date(metrics.expiresAt).toLocaleDateString("es-CO")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">Sin plan</p>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${accountOk ? "border-l-green-500" : "border-l-amber-500"}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estado de Cuenta</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {accountOk ? (
                <><CheckCircle2 className="h-5 w-5 text-green-500" /><span className="text-lg font-semibold text-green-600">Al día</span></>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-lg font-semibold text-amber-600">Pendiente</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{metrics.pendingPayments}</Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Abiertos</CardTitle>
            <TicketCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{metrics.openTickets}</p></CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-lg">¿Necesitas ayuda?</h3>
            <p className="text-sm text-muted-foreground">
              Crea un ticket de soporte y nuestro equipo te responderá lo más pronto posible.
            </p>
          </div>
          <Button size="lg" className="gap-2 shrink-0" onClick={onRequestSupport}>
            <Headphones className="h-4 w-4" />
            Solicitar Soporte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
