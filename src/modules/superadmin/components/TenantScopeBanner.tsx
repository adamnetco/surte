import { useEffect, useState } from "react";
import { Store, Copy, ExternalLink } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pendiente",    cls: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  trial:     { label: "Prueba",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  active:    { label: "Activa",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  past_due:  { label: "Pago vencido", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  suspended: { label: "Suspendida",   cls: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  archived:  { label: "Archivada",    cls: "bg-destructive/10 text-destructive" },
};

export default function TenantScopeBanner() {
  const { currentOrg } = useOrganization();
  const [lifecycle, setLifecycle] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) { setLifecycle(null); return; }
    let cancelled = false;
    supabase.from("organizations").select("lifecycle_state").eq("id", currentOrg.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setLifecycle((data as any)?.lifecycle_state ?? null); });
    return () => { cancelled = true; };
  }, [currentOrg?.id]);

  if (!currentOrg) return null;

  const copyId = () => {
    navigator.clipboard.writeText(currentOrg.id).then(() => toast.success("ID copiado"));
  };
  const badge = lifecycle ? STATE_BADGE[lifecycle] : null;

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Store size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
            Administrando tienda
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading font-bold text-base truncate">{currentOrg.name}</p>
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="font-mono">{currentOrg.slug}</span>
            <span>·</span>
            <button
              onClick={copyId}
              className="font-mono hover:text-foreground inline-flex items-center gap-1"
              title="Copiar UUID"
            >
              {currentOrg.id.slice(0, 8)}…<Copy size={10} />
            </button>
          </div>
        </div>
      </div>
      <a
        href={`/superadmin/t/${currentOrg.slug}`}
        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 shrink-0"
      >
        Salud de la tienda <ExternalLink size={11} />
      </a>
    </div>
  );
}
