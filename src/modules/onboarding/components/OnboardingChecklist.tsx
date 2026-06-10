/**
 * OnboardingChecklist — chip flotante con resumen de los hitos de activación.
 *
 * Aparece (bottom-right) cuando el usuario tiene una organización pero faltan
 * pasos críticos (licencia/módulos/SSL). Se oculta al completar todo y
 * recuerda el estado de "minimizado" en localStorage para no molestar.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle2, Circle, ChevronRight, ListChecks, X, Sparkles, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "sistecpos.onboarding.dismissedAt";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 12; // 12h

type Item = { id: string; label: string; done: boolean; to?: string };

const HIDDEN_ROUTES = [/^\/pos\//, /^\/kds/, /^\/print/, /^\/onboarding/, /^\/activacion/, /^\/auth/];

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const { currentOrg, modules, loading: orgLoading } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Respeta dismiss reciente
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < DISMISS_TTL_MS) setDismissed(true);
    } catch { /* noop */ }
  }, []);

  // Calcula los hitos
  useEffect(() => {
    let cancelled = false;
    if (!user || !currentOrg || orgLoading) return;
    setLoading(true);
    (async () => {
      const [{ data: lic }, { data: dom }] = await Promise.all([
        supabase.from("licenses").select("status")
          .eq("organization_id", currentOrg.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("tenant_domains").select("ssl_status")
          .eq("organization_id", currentOrg.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const enabled = modules.filter((m) => m.enabled).map((m) => m.module_key);
      const hasPos = enabled.includes("pos") || enabled.includes("pos_counter");

      const next: Item[] = [
        { id: "account",  label: "Cuenta creada",        done: !!user },
        { id: "tenant",   label: "Tienda configurada",   done: !!currentOrg },
        { id: "license",  label: "Licencia activa",      done: lic?.status === "active" || lic?.status === "trial", to: "/planes" },
        { id: "modules",  label: "Módulo POS activo",    done: hasPos, to: "/activacion" },
        { id: "domain",   label: "Subdominio + SSL",     done: dom?.ssl_status === "active", to: "/sitios" },
      ];
      if (!cancelled) {
        setItems(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, currentOrg, modules, orgLoading]);

  const doneCount = useMemo(() => items.filter((i) => i.done).length, [items]);
  const allDone = items.length > 0 && doneCount === items.length;

  const onHiddenRoute = HIDDEN_ROUTES.some((r) => r.test(location.pathname));
  const shouldShow = user && currentOrg && !allDone && !dismissed && !onHiddenRoute && items.length > 0;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setDismissed(true);
    setOpen(false);
  };

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            className="shadow-lg gap-2 pl-3 pr-4 h-10 rounded-full"
            aria-label={`Onboarding: ${doneCount} de ${items.length} pasos completos`}
          >
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20">
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-xs font-semibold tabular-nums">
              {doneCount}/{items.length}
            </span>
            <span className="hidden sm:inline text-xs">Activación</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          className="w-80 p-0 overflow-hidden"
          role="dialog"
          aria-label="Checklist de activación"
        >
          <header className="flex items-start justify-between gap-2 p-3 pb-2 border-b bg-muted/40">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold">Termina de configurar</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {doneCount} de {items.length} pasos listos
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 -mr-1 -mt-1"
              onClick={handleDismiss}
              aria-label="Recordar más tarde (12 horas)"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </header>

          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
              aria-hidden
            />
          </div>

          <ul className="p-2" role="list">
            {loading && items.length === 0 ? (
              <li className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              </li>
            ) : items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { if (item.to) { navigate(item.to); setOpen(false); } }}
                  disabled={!item.to || item.done}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left text-sm",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !item.done && item.to && "hover:bg-accent cursor-pointer",
                    item.done && "opacity-70"
                  )}
                  aria-label={`${item.label}: ${item.done ? "completo" : "pendiente"}`}
                >
                  {item.done
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />}
                  <span className={cn("flex-1", item.done && "line-through")}>{item.label}</span>
                  {!item.done && item.to && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <footer className="p-2 pt-1 border-t">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-8"
              onClick={() => { navigate("/activacion"); setOpen(false); }}
            >
              Abrir guía completa
              <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
            </Button>
          </footer>
        </PopoverContent>
      </Popover>
    </div>
  );
}
