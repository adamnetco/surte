/**
 * EntitlementsWizardStep — Componente único para mostrar y editar módulos
 * habilitados para un tenant, respetando el plan contratado.
 *
 * Fuente de verdad: v_tenant_entitlements_modules (via useEntitlements).
 * Escribe SIEMPRE a tenant_module_overrides, NUNCA a organization_modules (deprecada).
 *
 * Modes:
 *  - 'readonly':       solo muestra estado resuelto (sin toggles)
 *  - 'plan-baseline':  superadmin viendo lo que el plan entrega (read-only, badges de plan vs override)
 *  - 'override-only':  cliente puede toggle, pero limitado a módulos incluidos en el plan
 *
 * Ver docs/specs/POS-entitlements-wizard-unification.md
 */
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, type EntitlementModule } from "@/lib/entitlements/useEntitlements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Lock, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type EntitlementsWizardMode = "readonly" | "plan-baseline" | "override-only";

interface Props {
  organizationId: string;
  mode: EntitlementsWizardMode;
  /** Filtra los módulos visibles a estas keys. Si se omite, muestra todos. */
  moduleKeys?: string[];
  onChange?: (enabledKeys: string[]) => void;
  className?: string;
}

export function EntitlementsWizardStep({
  organizationId,
  mode,
  moduleKeys,
  onChange,
  className,
}: Props) {
  const { data: ent, isLoading, refetch } = useEntitlements(organizationId);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const items = useMemo(() => {
    if (!ent) return [] as Array<[string, EntitlementModule]>;
    const entries = Object.entries(ent.modules);
    return moduleKeys
      ? entries.filter(([k]) => moduleKeys.includes(k))
      : entries;
  }, [ent, moduleKeys]);

  async function toggle(moduleKey: string, currentEnabled: boolean, sourceIsPlan: boolean) {
    if (mode !== "override-only") return;

    // Bloqueo comercial: cliente NO puede activar lo que el plan no incluye.
    // (sourceIsPlan=false significa: el plan no incluye el módulo)
    if (!currentEnabled && !sourceIsPlan) {
      const target = await fetchUpgradePlan(moduleKey);
      const params = new URLSearchParams({
        ...(target ? { highlight: target } : {}),
        reason: moduleKey,
        return_to: location.pathname + location.search,
      });
      navigate(`/clientes/planes?${params.toString()}`);
      return;
    }

    setPending(moduleKey);
    try {
      // upsert override: enabled=true habilita explícitamente; false lo apaga
      const { error } = await supabase
        .from("tenant_module_overrides" as any)
        .upsert(
          {
            organization_id: organizationId,
            module_key: moduleKey,
            enabled: !currentEnabled,
            reason: "cliente_onboarding",
          },
          { onConflict: "organization_id,module_key" },
        );
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["entitlements", organizationId] });
      const r = await refetch();
      const newEnabled = Object.entries(r.data?.modules ?? {})
        .filter(([, v]) => v.enabled)
        .map(([k]) => k);
      onChange?.(newEnabled);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el módulo");
    } finally {
      setPending(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ent || items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        Sin módulos disponibles para esta organización.
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {items.map(([key, mod]) => {
        const sourceIsPlan = mod.source === "plan" || (mod.source === "override" && mod.enabled);
        const planIncludes = mod.source === "plan" || (mod.source === "override");
        const isLocked = mode === "override-only" && !mod.enabled && mod.source === "none";
        const isInteractive = mode === "override-only";
        const isLoading = pending === key;

        return (
          <button
            key={key}
            type="button"
            disabled={!isInteractive || isLoading}
            onClick={() => toggle(key, mod.enabled, planIncludes)}
            className={cn(
              "flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
              mod.enabled
                ? "border-primary bg-primary/5"
                : isLocked
                  ? "border-dashed border-muted bg-muted/30"
                  : "border-border bg-background",
              isInteractive && !isLoading && "hover:border-primary/40 cursor-pointer",
              !isInteractive && "cursor-default",
            )}
          >
            <div
              className={cn(
                "h-5 w-5 rounded-md border-2 grid place-items-center shrink-0 mt-0.5",
                mod.enabled
                  ? "border-primary bg-primary"
                  : isLocked
                    ? "border-muted-foreground/30"
                    : "border-muted-foreground/40",
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
              ) : mod.enabled ? (
                <Check className="h-3 w-3 text-primary-foreground" />
              ) : isLocked ? (
                <Lock className="h-3 w-3 text-muted-foreground" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{mod.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {mod.source === "override" && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    Override
                  </Badge>
                )}
                {mod.source === "plan" && mod.enabled && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    Plan
                  </Badge>
                )}
                {isLocked && (
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Requiere upgrade
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

async function fetchUpgradePlan(moduleKey: string): Promise<string | null> {
  const { data } = await supabase.rpc("get_upgrade_target_plan" as any, {
    _module_key: moduleKey,
  });
  return (data as string | null) ?? null;
}
