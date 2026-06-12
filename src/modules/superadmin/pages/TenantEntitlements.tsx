import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ToggleLeft, ToggleRight, Trash2, AlertTriangle, Pencil, Save, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { auditedMutation } from "@/lib/audit/auditedMutation";
import { handleAuditError } from "@/lib/audit/handleCosign";

type ModuleRow = {
  module_key: string;
  module_name: string;
  category: string | null;
  enabled: boolean;
  source: "plan" | "override" | "none";
};
type LimitRow = {
  limit_key: string;
  effective_value: number | null;
  plan_value: number | null;
  override_value: number | null;
  source: "plan" | "override";
};
type ModuleOverride = {
  id: string;
  module_key: string;
  enabled: boolean;
  reason: string | null;
  expires_at: string | null;
};
type LimitOverride = {
  id: string;
  limit_key: string;
  value: number | null;
  reason: string | null;
  expires_at: string | null;
};

const SourceBadge = ({ source }: { source: string }) => {
  const styles: Record<string, string> = {
    plan: "bg-muted text-muted-foreground",
    override: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
    none: "bg-destructive/10 text-destructive",
  };
  const label = source === "override" ? "Override" : source === "plan" ? "Plan" : "—";
  return <Badge className={`${styles[source] ?? ""} font-normal text-[10px] uppercase tracking-wider`}>{label}</Badge>;
};

const TenantEntitlements = () => {
  const { slug = "" } = useParams();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [limits, setLimits] = useState<LimitRow[]>([]);
  const [modOverrides, setModOverrides] = useState<Record<string, ModuleOverride>>({});
  const [limOverrides, setLimOverrides] = useState<Record<string, LimitOverride>>({});
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const [{ data: m }, { data: l }, { data: mo }, { data: lo }] = await Promise.all([
      supabase.from("v_tenant_entitlements_modules" as any).select("*").eq("organization_id", orgId).order("category").order("module_name"),
      supabase.from("v_tenant_entitlements_limits" as any).select("*").eq("organization_id", orgId).order("limit_key"),
      supabase.from("tenant_module_overrides").select("id, module_key, enabled, reason, expires_at").eq("organization_id", orgId),
      supabase.from("tenant_limit_overrides").select("id, limit_key, value, reason, expires_at").eq("organization_id", orgId),
    ]);
    setModules((m as any) ?? []);
    setLimits((l as any) ?? []);
    setModOverrides(Object.fromEntries(((mo as any) ?? []).map((r: ModuleOverride) => [r.module_key, r])));
    setLimOverrides(Object.fromEntries(((lo as any) ?? []).map((r: LimitOverride) => [r.limit_key, r])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  const grouped = useMemo(() => {
    const g: Record<string, ModuleRow[]> = {};
    modules.forEach((m) => {
      const k = m.category || "Otros";
      (g[k] ||= []).push(m);
    });
    return g;
  }, [modules]);

  const toggleModuleOverride = async (mod: ModuleRow, nextEnabled: boolean | null) => {
    if (!orgId) return;
    const reason = window.prompt(
      nextEnabled === null
        ? `Eliminar override de "${mod.module_name}" (volver al plan).\nMotivo (auditoría):`
        : `${nextEnabled ? "Habilitar" : "Deshabilitar"} "${mod.module_name}" para esta tienda.\nMotivo (auditoría):`,
      modOverrides[mod.module_key]?.reason ?? ""
    );
    if (reason === null) return;
    if (!reason.trim()) return toast.error("Motivo requerido");

    try {
      await auditedMutation({
        action: "single_module_override",
        targetOrgId: orgId,
        payload: {
          module_key: mod.module_key,
          module_name: mod.module_name,
          op: nextEnabled === null ? "remove" : "upsert",
          enabled: nextEnabled,
        },
        justification: reason.trim(),
        run: async () => {
          if (nextEnabled === null) {
            const id = modOverrides[mod.module_key]?.id;
            if (!id) return { skipped: true };
            const { error } = await supabase.from("tenant_module_overrides").delete().eq("id", id);
            if (error) throw error;
            return { removed: id };
          }
          const { error } = await supabase
            .from("tenant_module_overrides")
            .upsert(
              { organization_id: orgId, module_key: mod.module_key, enabled: nextEnabled, reason: reason.trim() || null },
              { onConflict: "organization_id,module_key" }
            );
          if (error) throw error;
          return { upserted: mod.module_key, enabled: nextEnabled };
        },
      });
      toast.success(nextEnabled === null ? "Override eliminado" : "Override aplicado");
      load();
    } catch (e) {
      handleAuditError(e);
    }
  };

  const startEditLimit = (lim: LimitRow) => {
    setEditingLimit(lim.limit_key);
    setEditValue(String(limOverrides[lim.limit_key]?.value ?? lim.effective_value ?? ""));
    setEditReason(limOverrides[lim.limit_key]?.reason ?? "");
  };

  const saveLimit = async (lim: LimitRow) => {
    if (!orgId) return;
    const value = editValue.trim() === "" ? null : Number(editValue);
    if (value !== null && (Number.isNaN(value) || value < 0)) return toast.error("Valor inválido");
    if (!editReason.trim()) return toast.error("Motivo requerido para auditoría");
    try {
      await auditedMutation({
        action: "single_limit_override",
        targetOrgId: orgId,
        payload: { limit_key: lim.limit_key, value, op: "upsert" },
        justification: editReason.trim(),
        run: async () => {
          const { error } = await supabase
            .from("tenant_limit_overrides")
            .upsert(
              { organization_id: orgId, limit_key: lim.limit_key, value, reason: editReason.trim() || null },
              { onConflict: "organization_id,limit_key" }
            );
          if (error) throw error;
          return { upserted: lim.limit_key, value };
        },
      });
      toast.success("Límite override guardado");
      setEditingLimit(null);
      load();
    } catch (e) {
      handleAuditError(e);
    }
  };

  const removeLimitOverride = async (lim: LimitRow) => {
    const id = limOverrides[lim.limit_key]?.id;
    if (!id || !orgId) return;
    const reason = window.prompt(`Eliminar override del límite "${lim.limit_key}" y volver al plan.\nMotivo (auditoría):`, "");
    if (reason === null) return;
    if (!reason.trim()) return toast.error("Motivo requerido");
    try {
      await auditedMutation({
        action: "single_limit_override",
        targetOrgId: orgId,
        payload: { limit_key: lim.limit_key, op: "remove" },
        justification: reason.trim(),
        run: async () => {
          const { error } = await supabase.from("tenant_limit_overrides").delete().eq("id", id);
          if (error) throw error;
          return { removed: id };
        },
      });
      toast.success("Override eliminado");
      load();
    } catch (e) {
      handleAuditError(e);
    }
  };

  if (!currentOrg) {
    return <div className="p-6 text-sm text-muted-foreground">Selecciona una tienda primero.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <ShieldCheck size={12} /> Entitlements · {slug}
          </div>
          <h1 className="text-xl font-bold mt-1">Anulaciones de módulos y límites</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Los overrides anulan lo que define el plan para <strong>{currentOrg.name}</strong>. Cada cambio
            queda auditado. Usar con motivo claro: contrato enterprise, promoción, soporte de incidente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const reason = window.prompt(
                "Solicitar cambio masivo de módulos para esta tienda.\nRequiere co-firma de otro superadmin.\n\nJustificación:",
                "Prueba del pipeline de co-firma"
              );
              if (!reason?.trim()) return;
              try {
                await auditedMutation({
                  action: "bulk_module_override",
                  targetOrgId: orgId!,
                  payload: { test: true, scope: "single-tenant" },
                  justification: reason.trim(),
                  run: async () => ({ noop: true }),
                });
                toast.success("Solicitud creada y aprobada (no requería co-firma).");
              } catch (e) {
                handleAuditError(e);
              }
            }}
            title="Crea una solicitud en la cola de acciones críticas"
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Test co-firma
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recargar"}
          </Button>
        </div>
      </header>

      {/* MODULES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Módulos ({modules.length})
          </h2>
          <div className="text-[11px] text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Plan</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Override</span>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : (
          Object.entries(grouped).map(([cat, rows]) => (
            <div key={cat} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{cat}</div>
              <ul className="divide-y divide-border">
                {rows.map((m) => {
                  const ov = modOverrides[m.module_key];
                  return (
                    <li key={m.module_key} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{m.module_name}</span>
                          <SourceBadge source={m.source} />
                          {m.enabled ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 font-normal text-[10px]">Activo</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground font-normal text-[10px]">Inactivo</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{m.module_key}</div>
                        {ov?.reason && <div className="text-[11px] text-orange-700 dark:text-orange-300 mt-1">↳ {ov.reason}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant={m.enabled ? "secondary" : "default"} onClick={() => toggleModuleOverride(m, !m.enabled)}>
                          {m.enabled ? <ToggleLeft className="h-4 w-4 mr-1" /> : <ToggleRight className="h-4 w-4 mr-1" />}
                          {m.enabled ? "Deshabilitar" : "Habilitar"}
                        </Button>
                        {m.source === "override" && (
                          <Button size="sm" variant="ghost" onClick={() => toggleModuleOverride(m, null)} title="Eliminar override">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* LIMITS */}
      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Límites ({limits.length})
        </h2>
        {limits.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            El plan no tiene límites definidos. Ve a <a className="underline" href="/superadmin/planes">Catálogo de Planes</a> para agregarlos.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Límite</th>
                  <th className="text-right px-4 py-2 font-medium">Plan</th>
                  <th className="text-right px-4 py-2 font-medium">Override</th>
                  <th className="text-right px-4 py-2 font-medium">Efectivo</th>
                  <th className="text-right px-4 py-2 font-medium w-40">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {limits.map((lim) => {
                  const editing = editingLimit === lim.limit_key;
                  const fmt = (v: number | null) => (v == null ? "∞" : v.toLocaleString());
                  return (
                    <tr key={lim.limit_key} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{lim.limit_key}</div>
                        <div className="mt-1"><SourceBadge source={lim.source} /></div>
                        {limOverrides[lim.limit_key]?.reason && (
                          <div className="text-[11px] text-orange-700 dark:text-orange-300 mt-1">↳ {limOverrides[lim.limit_key]?.reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(lim.plan_value)}</td>
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="vacío = ∞"
                              className="h-8 w-24 text-right font-mono"
                            />
                          </div>
                        ) : (
                          <span className="font-mono text-orange-700 dark:text-orange-300">{lim.override_value != null ? fmt(lim.override_value) : "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(lim.effective_value)}</td>
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder="motivo"
                              className="h-8 w-32 text-xs"
                            />
                            <Button size="sm" onClick={() => saveLimit(lim)}><Save className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingLimit(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => startEditLimit(lim)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                            {lim.source === "override" && (
                              <Button size="sm" variant="ghost" onClick={() => removeLimitOverride(lim)} title="Eliminar override">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default TenantEntitlements;
