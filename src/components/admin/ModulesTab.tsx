import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Module {
  key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  sort_order: number;
}

export default function ModulesTab() {
  const { currentOrg, refresh } = useOrganization();
  const [modules, setModules] = useState<Module[]>([]);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: cat }, { data: enabled }] = await Promise.all([
        supabase.from("modules").select("*").eq("is_active", true).order("sort_order"),
        currentOrg
          ? supabase
              .from("organization_modules")
              .select("module_key, enabled")
              .eq("organization_id", currentOrg.id)
          : Promise.resolve({ data: [] as any }),
      ]);
      if (cancelled) return;
      setModules((cat ?? []) as Module[]);
      const map: Record<string, boolean> = {};
      (enabled ?? []).forEach((e: any) => (map[e.module_key] = e.enabled));
      setActive(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentOrg?.id]);

  const grouped = useMemo(() => {
    const g: Record<string, Module[]> = {};
    modules.forEach((m) => { (g[m.category] ??= []).push(m); });
    return g;
  }, [modules]);

  const toggle = async (key: string, next: boolean) => {
    if (!currentOrg) return;
    setSavingKey(key);
    const { error } = await supabase
      .from("organization_modules")
      .upsert(
        { organization_id: currentOrg.id, module_key: key, enabled: next },
        { onConflict: "organization_id,module_key" }
      );
    setSavingKey(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setActive((p) => ({ ...p, [key]: next }));
    toast.success(next ? "Módulo activado" : "Módulo desactivado");
    refresh();
  };

  if (!currentOrg) return <div className="p-4 text-sm text-muted-foreground">Selecciona una organización.</div>;
  if (loading) return <div className="p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="font-heading text-xl font-bold">Módulos de {currentOrg.name}</h2>
        <p className="text-sm text-muted-foreground">
          Activa solo lo que esta organización necesita. Las pestañas del admin aparecen según los módulos activos.
        </p>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground">{cat}</h3>
            <Badge variant="outline">{items.length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((m) => {
              const on = !!active[m.key];
              return (
                <div
                  key={m.key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="font-heading font-semibold">{m.name}</div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                    )}
                    <code className="text-[10px] text-muted-foreground">{m.key}</code>
                  </div>
                  <Switch checked={on} onCheckedChange={(v) => toggle(m.key, v)} disabled={savingKey === m.key} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
