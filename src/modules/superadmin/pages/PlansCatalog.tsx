import { Skeleton } from "@/components/ui/skeleton";
/**
 * /superadmin/planes — Editor único Plan × Módulos × Límites.
 * Fuente de verdad: tablas plan_modules + plan_limits.
 * saas_plans.modules (jsonb) se mantiene sincronizado por trigger DB.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Package, Gauge } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Plan = { id: string; key: string; name: string; price_monthly: number; sort_order: number };
type Mod = { key: string; name: string; category: string };
type PlanModule = { plan_id: string; module_key: string; included: boolean };
type PlanLimit = { plan_id: string; limit_key: string; value: number | null };

const LIMIT_KEYS = [
  { key: "max_terminals", label: "Terminales POS" },
  { key: "max_users", label: "Usuarios" },
  { key: "max_locations", label: "Sucursales" },
  { key: "max_products", label: "Productos" },
  { key: "max_api_calls_monthly", label: "Llamadas API / mes" },
];

export default function PlansCatalog() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Mod[]>([]);
  const [planModules, setPlanModules] = useState<PlanModule[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimit[]>([]);

  const load = async () => {
    setLoading(true);
    const [p, m, pm, pl] = await Promise.all([
      supabase.from("saas_plans").select("id,key,name,price_monthly,sort_order").order("sort_order"),
      supabase.from("modules").select("key,name,category").order("category").order("key"),
      supabase.from("plan_modules").select("plan_id,module_key,included"),
      supabase.from("plan_limits").select("plan_id,limit_key,value"),
    ]);
    setPlans((p.data as Plan[]) ?? []);
    setModules((m.data as Mod[]) ?? []);
    setPlanModules((pm.data as PlanModule[]) ?? []);
    setPlanLimits((pl.data as PlanLimit[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const moduleByCat = useMemo(() => {
    const g: Record<string, Mod[]> = {};
    modules.forEach((m) => { (g[m.category] ??= []).push(m); });
    return g;
  }, [modules]);

  const isOn = (planId: string, key: string) =>
    planModules.some((r) => r.plan_id === planId && r.module_key === key && r.included !== false);

  const limitVal = (planId: string, key: string): number | null => {
    const r = planLimits.find((x) => x.plan_id === planId && x.limit_key === key);
    return r ? r.value : null;
  };

  const toggleModule = async (plan: Plan, key: string, next: boolean) => {
    setSaving(`${plan.id}:${key}`);
    try {
      if (next) {
        const { error } = await supabase
          .from("plan_modules")
          .upsert({ plan_id: plan.id, module_key: key, included: true }, { onConflict: "plan_id,module_key" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("plan_modules")
          .delete()
          .eq("plan_id", plan.id)
          .eq("module_key", key);
        if (error) throw error;
      }
      // Optimistic local update
      setPlanModules((prev) => {
        const without = prev.filter((r) => !(r.plan_id === plan.id && r.module_key === key));
        return next ? [...without, { plan_id: plan.id, module_key: key, included: true }] : without;
      });
      toast.success(`${plan.name}: ${next ? "+" : "-"}${key}`);
    } catch (e: any) {
      toast.error(e.message ?? "Error guardando módulo");
    } finally {
      setSaving(null);
    }
  };

  const saveLimit = async (plan: Plan, key: string, raw: string) => {
    const value = raw === "" ? null : Number(raw);
    if (raw !== "" && (Number.isNaN(value) || (value as number) < 0)) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(`${plan.id}:limit:${key}`);
    try {
      const { error } = await supabase
        .from("plan_limits")
        .upsert({ plan_id: plan.id, limit_key: key, value }, { onConflict: "plan_id,limit_key" });
      if (error) throw error;
      setPlanLimits((prev) => {
        const without = prev.filter((r) => !(r.plan_id === plan.id && r.limit_key === key));
        return [...without, { plan_id: plan.id, limit_key: key, value }];
      });
      toast.success(`${plan.name} · ${key}: ${value ?? "ilimitado"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Error guardando límite");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite" aria-label="Cargando catálogo de planes">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package size={20} /> Catálogo de Planes
          </h1>
          <p className="text-sm text-muted-foreground">
            Fuente única de verdad. Cambios aplican a nuevos onboardings; tenants existentes mantienen su snapshot hasta cambiar de plan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>Recargar</Button>
      </header>

      {/* Matriz Plan × Módulo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package size={16} /> Módulos por plan
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Módulo</th>
                {plans.map((p) => (
                  <th key={p.id} className="text-center py-2 px-3 min-w-[100px]">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.key}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(moduleByCat).map(([cat, mods]) => (
                <>
                  <tr key={cat}>
                    <td colSpan={plans.length + 1} className="pt-3 pb-1">
                      <Badge variant="outline" className="text-[10px] uppercase">{cat}</Badge>
                    </td>
                  </tr>
                  {mods.map((m) => (
                    <tr key={m.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 px-2">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">{m.key}</div>
                      </td>
                      {plans.map((p) => {
                        const id = `${p.id}:${m.key}`;
                        return (
                          <td key={id} className="text-center py-1.5">
                            <Checkbox
                              checked={isOn(p.id, m.key)}
                              disabled={saving === id}
                              onCheckedChange={(v) => toggleModule(p, m.key, Boolean(v))}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Matriz Plan × Límite */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge size={16} /> Límites por plan
          </CardTitle>
          <p className="text-xs text-muted-foreground">Deja vacío para "ilimitado".</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Límite</th>
                {plans.map((p) => (
                  <th key={p.id} className="text-center py-2 px-3 min-w-[120px]">
                    <div className="font-semibold">{p.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMIT_KEYS.map((lk) => (
                <tr key={lk.key} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2">
                    <div className="font-medium">{lk.label}</div>
                    <div className="text-[10px] text-muted-foreground">{lk.key}</div>
                  </td>
                  {plans.map((p) => {
                    const id = `${p.id}:limit:${lk.key}`;
                    const v = limitVal(p.id, lk.key);
                    return (
                      <td key={id} className="py-1.5 px-2">
                        <LimitInput
                          initial={v}
                          disabled={saving === id}
                          onSave={(raw) => saveLimit(p, lk.key, raw)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function LimitInput({
  initial,
  disabled,
  onSave,
}: {
  initial: number | null;
  disabled: boolean;
  onSave: (raw: string) => void;
}) {
  const [v, setV] = useState<string>(initial == null ? "" : String(initial));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setV(initial == null ? "" : String(initial));
    setDirty(false);
  }, [initial]);

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        value={v}
        placeholder="∞"
        disabled={disabled}
        onChange={(e) => { setV(e.target.value); setDirty(true); }}
        className="h-8 text-xs"
      />
      {dirty && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={disabled}
          onClick={() => { onSave(v); setDirty(false); }}
          aria-label="Guardar"
        >
          <Save size={12} />
        </Button>
      )}
    </div>
  );
}
