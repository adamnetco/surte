/**
 * ActivationStatus — pantalla guía de "qué falta para empezar".
 *
 * Stepper visual con los 5 hitos del onboarding técnico:
 *  1. Cuenta creada
 *  2. Licencia activa
 *  3. Tienda configurada (slug)
 *  4. Módulos activos
 *  5. Subdominio + SSL listo
 *
 * Cada hito muestra estado real (leído de BD) y CTA contextual.
 * Pensado para destrabar al usuario tras crear su primera tienda.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Globe,
  Boxes,
  Building2,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type StepState = "done" | "pending" | "warning" | "loading";

interface Step {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  state: StepState;
  detail?: string;
  cta?: { label: string; to?: string; href?: string };
}

export default function ActivationStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg, modules, loading: orgLoading } = useOrganization();
  const [steps, setSteps] = useState<Step[]>([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    document.title = "Estado de activación · SistecPOS";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (orgLoading) return;
      setChecking(true);

      const acc: Step[] = [];

      // 1. Cuenta
      acc.push({
        id: "account",
        icon: User,
        title: "Cuenta creada",
        description: "Tu usuario está activo en SistecPOS.",
        state: user ? "done" : "pending",
        detail: user?.email ?? undefined,
      });

      // 2. Licencia
      let licState: StepState = "pending";
      let licDetail = "Aún no hay licencia registrada.";
      if (currentOrg) {
        const { data: lic } = await supabase
          .from("licenses")
          .select("status, expires_at")
          .eq("organization_id", currentOrg.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lic) {
          if (lic.status === "active" || lic.status === "trial") {
            licState = "done";
            licDetail = `Plan ${lic.status}${lic.expires_at ? ` · vence ${new Date(lic.expires_at).toLocaleDateString("es-CO")}` : ""}`;
          } else {
            licState = "warning";
            licDetail = `Estado: ${lic.status}`;
          }
        }
      }
      acc.push({
        id: "license",
        icon: ShieldCheck,
        title: "Licencia activa",
        description: "Define qué módulos puedes usar y por cuánto tiempo.",
        state: licState,
        detail: licDetail,
        cta: licState !== "done" ? { label: "Ver planes", to: "/planes" } : undefined,
      });

      // 3. Tienda configurada
      acc.push({
        id: "tenant",
        icon: Building2,
        title: "Tienda configurada",
        description: "Nombre comercial y URL únicos para tu negocio.",
        state: currentOrg ? "done" : "pending",
        detail: currentOrg ? `${currentOrg.name} · ${currentOrg.slug}` : undefined,
        cta: !currentOrg ? { label: "Crear tienda", to: "/onboarding" } : undefined,
      });

      // 4. Módulos activos
      const enabled = modules.filter((m) => m.enabled).map((m) => m.module_key);
      const hasPos = enabled.includes("pos") || enabled.includes("pos_counter");
      acc.push({
        id: "modules",
        icon: Boxes,
        title: "Módulos activos",
        description: "Funciones habilitadas para tu tienda.",
        state: hasPos ? "done" : enabled.length > 0 ? "warning" : "pending",
        detail:
          enabled.length > 0
            ? `${enabled.length} activo(s): ${enabled.slice(0, 4).join(", ")}${enabled.length > 4 ? "…" : ""}`
            : "Sin módulos activos todavía.",
        cta: !hasPos ? { label: "Activar POS", to: "/admin?tab=modules" } : undefined,
      });

      // 5. Subdominio + SSL
      let sslState: StepState = "pending";
      let sslDetail = "Sin subdominio asignado.";
      if (currentOrg) {
        const { data: dom } = await supabase
          .from("tenant_domains")
          .select("hostname, ssl_status")
          .eq("organization_id", currentOrg.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (dom) {
          if (dom.ssl_status === "active") {
            sslState = "done";
            sslDetail = `${dom.hostname} · SSL emitido`;
          } else {
            sslState = "warning";
            sslDetail = `${dom.hostname} · SSL ${dom.ssl_status ?? "pendiente"}`;
          }
        }
      }
      acc.push({
        id: "domain",
        icon: Globe,
        title: "Subdominio + SSL",
        description: "Tu tienda online accesible desde su URL pública.",
        state: sslState,
        detail: sslDetail,
        cta: sslState !== "done" ? { label: "Ir a Sitios", to: "/sitios" } : undefined,
      });

      if (!cancelled) {
        setSteps(acc);
        setChecking(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrg, modules, orgLoading]);

  const doneCount = steps.filter((s) => s.state === "done").length;
  const total = steps.length || 5;
  const allCriticalReady = steps.slice(0, 4).every((s) => s.state === "done");

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <AppBreadcrumb currentLabel="Estado de activación" />

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight">Estado de activación</h1>
          </div>
          <p className="text-muted-foreground">
            Sigue estos pasos para dejar tu tienda lista al 100%.
          </p>
          <div
            className="flex items-center gap-3 pt-1"
            aria-label={`Progreso: ${doneCount} de ${total} pasos completos`}
          >
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(doneCount / total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums">
              {doneCount}/{total}
            </span>
          </div>
        </header>

        {checking && steps.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ol className="space-y-3" role="list">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <li key={s.id}>
                  <Card
                    className={cn(
                      "transition-colors",
                      s.state === "done" && "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10",
                      s.state === "warning" && "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10",
                      s.state === "pending" && "border-border"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full shrink-0",
                            s.state === "done"
                              ? "bg-emerald-100 text-emerald-700"
                              : s.state === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted text-muted-foreground"
                          )}
                          aria-hidden="true"
                        >
                          {s.state === "done" ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">
                              {idx + 1}. {s.title}
                            </CardTitle>
                            <Badge
                              variant={s.state === "done" ? "default" : "secondary"}
                              className={cn(
                                s.state === "done" && "bg-emerald-600 hover:bg-emerald-600",
                                s.state === "warning" && "bg-amber-500 hover:bg-amber-500 text-white",
                                s.state === "pending" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {s.state === "done"
                                ? "Listo"
                                : s.state === "warning"
                                ? "Atención"
                                : "Pendiente"}
                            </Badge>
                          </div>
                          <CardDescription className="mt-0.5">
                            {s.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    {(s.detail || s.cta) && (
                      <CardContent className="pt-0 pl-[3.75rem] space-y-3">
                        {s.detail ? (
                          <p className="text-sm text-muted-foreground">{s.detail}</p>
                        ) : null}
                        {s.cta ? (
                          <Button
                            size="sm"
                            variant={s.state === "done" ? "outline" : "default"}
                            onClick={() => s.cta?.to && navigate(s.cta.to)}
                            className="focus-visible:ring-2"
                          >
                            {s.cta.label}
                            <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </CardContent>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}

        <div className="sticky bottom-4 pt-2">
          <Card className="border-2 border-primary/30 bg-primary/5 shadow-lg">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">
                  {allCriticalReady ? "¡Todo listo para vender!" : "Continúa con los pasos pendientes"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {allCriticalReady
                    ? "Tu POS está operativo. Abre la caja y vende."
                    : "El POS se desbloquea cuando completes los 4 primeros pasos."}
                </p>
              </div>
              <Button
                onClick={() => navigate("/pos")}
                disabled={!allCriticalReady}
                className="focus-visible:ring-2 shrink-0"
              >
                Ir al POS
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
