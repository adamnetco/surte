import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, ArrowLeft, Clock, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const COP = (n: number) => "$" + Math.round(Number(n || 0)).toLocaleString("es-CO");

type DunningCase = {
  id: string; status: string; attempt_count: number; total_amount_cop: number;
  failure_reason: string | null; opened_at: string; grace_until: string | null;
  subscription_id: string | null; invoice_id: string | null; next_retry_at: string | null;
};

export default function BillingRecover() {
  const { currentOrg } = useOrganization();
  const [cases, setCases] = useState<DunningCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("dunning_cases")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .in("status", ["open", "paused"])
      .order("opened_at", { ascending: false });
    setCases((data ?? []) as DunningCase[]);
    setLoading(false);
  };

  useEffect(() => { load(); document.title = "Recuperar pago · SistecPOS"; /* eslint-disable-next-line */ }, [currentOrg]);

  const payNow = async (c: DunningCase) => {
    if (!currentOrg) return;
    setPaying(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("wompi-create-subscription", {
        body: {
          organization_id: currentOrg.id,
          subscription_id: c.subscription_id,
          dunning_case_id: c.id,
          recovery: true,
          return_to: "/billing/recover",
        },
      });
      if (error) throw error;
      const url = (data as any)?.checkout_url ?? (data as any)?.url;
      if (url) window.location.href = url;
      else toast.info("Pago iniciado. Te avisaremos cuando se confirme.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo iniciar el pago");
    } finally {
      setPaying(null);
    }
  };

  if (!currentOrg) return <div className="p-6">Selecciona una organización</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-bold">Recuperar pago y reactivar</h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/billing"><ArrowLeft className="h-4 w-4 mr-1" /> Volver a facturación</Link>
        </Button>
      </div>

      {loading ? (
        <Card className="p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-40" />
        </Card>
      ) : cases.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No tienes pagos pendientes. ✅</p>
        </Card>
      ) : (
        cases.map((c) => {
          const graceDays = c.grace_until
            ? Math.max(0, Math.ceil((new Date(c.grace_until).getTime() - Date.now()) / 86400000))
            : null;
          const isPaused = c.status === "paused";
          return (
            <Card key={c.id} className={`p-5 border-l-4 ${isPaused ? "border-l-destructive" : "border-l-amber-500"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isPaused ? "destructive" : "secondary"}>
                      {isPaused ? "Cuenta suspendida" : "En recuperación"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Intento {c.attempt_count}/4</span>
                  </div>
                  <h3 className="text-lg font-bold">{COP(c.total_amount_cop)} COP pendientes</h3>
                  {c.failure_reason && (
                    <p className="text-xs text-muted-foreground">Motivo: {c.failure_reason}</p>
                  )}
                  {graceDays !== null && !isPaused && (
                    <p className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      {graceDays > 0
                        ? `Quedan ${graceDays} día(s) de gracia antes de suspender.`
                        : "Gracia expirada — paga ahora para evitar suspensión inmediata."}
                    </p>
                  )}
                  {isPaused && (
                    <p className="text-xs text-destructive">
                      Tu acceso está restringido. Completa el pago para reactivar.
                    </p>
                  )}
                </div>
                <Button onClick={() => payNow(c)} disabled={paying === c.id} size="lg">
                  {paying === c.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Pagar y {isPaused ? "reactivar" : "ponerme al día"}
                </Button>
              </div>
            </Card>
          );
        })
      )}

      <p className="text-xs text-muted-foreground text-center">
        Si tu método de pago cambió, actualízalo desde el checkout de Wompi. Recibirás confirmación por correo en cuanto el pago se apruebe.
      </p>
    </div>
  );
}
