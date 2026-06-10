/**
 * ModuleInactiveScreen — pantalla amistosa cuando un módulo está bloqueado.
 *
 * Reemplaza el genérico "Módulo X no activo" con un diagnóstico claro
 * y CTAs accionables. Lee el estado real (licencia, módulos) para
 * explicarle al usuario qué falta y cómo continuar.
 *
 * A11y: usa landmark <main>, heading h1, botones con focus visible,
 * iconografía decorativa marcada `aria-hidden`.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, CheckCircle2, AlertCircle, ArrowRight, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import AppBreadcrumb from "@/components/AppBreadcrumb";

interface Props {
  /** Clave del módulo requerido (ej: "pos_counter"). */
  moduleKey: string;
  /** Label legible (ej: "POS / Caja"). */
  moduleLabel: string;
}

interface CheckItem {
  label: string;
  done: boolean;
  hint?: string;
}

export function ModuleInactiveScreen({ moduleKey, moduleLabel }: Props) {
  const navigate = useNavigate();
  const { currentOrg, modules } = useOrganization();
  const [checks, setChecks] = useState<CheckItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const items: CheckItem[] = [];

      // 1. Organización activa
      items.push({
        label: "Tienda seleccionada",
        done: !!currentOrg,
        hint: currentOrg ? currentOrg.name : "Sin tienda activa",
      });

      if (!currentOrg) {
        if (!cancelled) setChecks(items);
        return;
      }

      // 2. Licencia activa
      const { data: lic } = await supabase
        .from("licenses")
        .select("id, status, expires_at, plan_id")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const licOk = !!lic && (lic.status === "active" || lic.status === "trial");
      items.push({
        label: "Licencia activa",
        done: licOk,
        hint: lic
          ? `Estado: ${lic.status}${lic.expires_at ? ` · vence ${new Date(lic.expires_at).toLocaleDateString("es-CO")}` : ""}`
          : "No hay licencia registrada",
      });

      // 3. Módulo habilitado
      const m = modules.find(
        (x) =>
          x.module_key === moduleKey ||
          (moduleKey === "pos_counter" && x.module_key === "pos")
      );
      items.push({
        label: `Módulo ${moduleLabel} habilitado`,
        done: !!m && m.enabled,
        hint: !m
          ? "El módulo aún no se ha activado en la tienda"
          : !m.enabled
          ? "Módulo desactivado por el administrador"
          : m.expires_at && new Date(m.expires_at) < new Date()
          ? "Módulo vencido"
          : "Listo",
      });

      if (!cancelled) setChecks(items);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [currentOrg, modules, moduleKey, moduleLabel]);

  const waLink = `https://wa.me/573170000000?text=${encodeURIComponent(
    `Hola, necesito ayuda para activar el módulo ${moduleLabel}${currentOrg ? ` en mi tienda ${currentOrg.name}` : ""}.`
  )}`;

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <AppBreadcrumb currentLabel={`${moduleLabel} (inactivo)`} />

        <Card className="border-2 border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shrink-0"
                aria-hidden="true"
              >
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl">
                  El módulo {moduleLabel} aún no está activo
                </CardTitle>
                <CardDescription>
                  Sigamos paso a paso para dejarlo listo en menos de un minuto.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <section aria-labelledby="checks-heading">
              <h2 id="checks-heading" className="sr-only">
                Diagnóstico de activación
              </h2>
              {!checks ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Verificando estado…
                </div>
              ) : (
                <ul className="space-y-2.5" role="list">
                  {checks.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg border bg-background p-3"
                    >
                      {c.done ? (
                        <CheckCircle2
                          className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5"
                          aria-label="Completado"
                        />
                      ) : (
                        <AlertCircle
                          className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"
                          aria-label="Pendiente"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.label}</p>
                        {c.hint ? (
                          <p className="text-xs text-muted-foreground">{c.hint}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={() => navigate("/activacion")}
                className="focus-visible:ring-2"
              >
                Ver estado de activación
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="focus-visible:ring-2"
              >
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Contactar soporte
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default ModuleInactiveScreen;
