/**
 * Ola 6 — Slice I (AC3)
 * Tour interactivo ligero (sin driver.js) que se dispara una sola vez
 * por usuario+org tras el primer login en `/admin` o `/admin/diario`.
 *
 * - Busca elementos con `data-tour="<id>"` en el DOM.
 * - Pinta un spotlight (clip-path con backdrop) y un tooltip posicionado.
 * - "Saltar" o terminar persiste un flag en localStorage por scope.
 * - Si un step no existe en pantalla, lo omite (no bloquea el flow).
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

type Step = {
  id: string;
  title: string;
  body: string;
  /** Si no encuentra el target, el tooltip se centra en pantalla. */
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    id: "diario",
    title: "Tu Diario",
    body: "Hub matinal: KPIs, pendientes y atajos. Empieza aquí cada día.",
    optional: true,
  },
  {
    id: "command-palette",
    title: "Búsqueda global ⌘K",
    body: "Pulsa Ctrl/⌘ + K en cualquier momento para saltar a productos, pedidos o acciones.",
    optional: true,
  },
  {
    id: "quick-actions",
    title: "Acciones rápidas",
    body: "El FAB inferior agrupa atajos contextuales según la pantalla.",
    optional: true,
  },
  {
    id: "onboarding-checklist",
    title: "Checklist de activación",
    body: "Aquí verás los pasos que faltan para tener tu tienda 100% operativa.",
    optional: true,
  },
];

const ACTIVE_ROUTES = [/^\/admin(\/diario)?\/?$/];

export default function FirstLoginTour() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { pathname } = useLocation();

  const scopeKey = useMemo(
    () => (user && currentOrg ? `sistecpos:tour:v1:${user.id}:${currentOrg.id}` : null),
    [user, currentOrg],
  );

  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Dispara una vez por scope si ruta aplica
  useEffect(() => {
    if (!scopeKey) return;
    if (!ACTIVE_ROUTES.some((r) => r.test(pathname))) return;
    try {
      if (localStorage.getItem(scopeKey)) return;
    } catch {
      return;
    }
    // pequeño delay para que el DOM monte
    const t = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(t);
  }, [scopeKey, pathname]);

  const step = STEPS[stepIdx];

  // Mide el target del paso actual
  useLayoutEffect(() => {
    if (!active || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, step]);

  const finish = (skipped = false) => {
    if (scopeKey) {
      try {
        localStorage.setItem(scopeKey, skipped ? "skipped" : "done");
      } catch {
        /* noop */
      }
    }
    setActive(false);
    setStepIdx(0);
  };

  const next = () => {
    if (stepIdx >= STEPS.length - 1) finish(false);
    else setStepIdx((i) => i + 1);
  };

  if (!active || !step) return null;

  // Layout del tooltip
  const PADDING = 8;
  const TOOLTIP_W = 320;
  const TOOLTIP_H = 160;
  let tipTop = window.innerHeight / 2 - TOOLTIP_H / 2;
  let tipLeft = window.innerWidth / 2 - TOOLTIP_W / 2;
  let spotlight: React.CSSProperties = { display: "none" };

  if (rect) {
    spotlight = {
      position: "fixed",
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
      borderRadius: 12,
      boxShadow: "0 0 0 9999px rgba(15,23,42,0.65)",
      pointerEvents: "none",
      transition: "all 200ms ease",
      zIndex: 9998,
    };
    // posicionar tooltip debajo si cabe, sino arriba
    const below = rect.bottom + 12 + TOOLTIP_H < window.innerHeight;
    tipTop = below ? rect.bottom + 12 : Math.max(12, rect.top - TOOLTIP_H - 12);
    tipLeft = Math.min(
      Math.max(12, rect.left + rect.width / 2 - TOOLTIP_W / 2),
      window.innerWidth - TOOLTIP_W - 12,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-label={`Tour: ${step.title}`}
      aria-modal="false"
      className="print:hidden"
    >
      {/* Backdrop sin target (oscurece todo) */}
      {!rect && (
        <div
          className="fixed inset-0 bg-slate-900/65 z-[9998]"
          aria-hidden
          onClick={() => finish(true)}
        />
      )}
      {rect && <div style={spotlight} aria-hidden />}

      <div
        className="fixed bg-background border border-border rounded-xl shadow-2xl p-4 z-[9999] animate-in fade-in zoom-in-95 duration-200"
        style={{ top: tipTop, left: tipLeft, width: TOOLTIP_W }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-sm font-semibold">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => finish(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {stepIdx + 1} de {STEPS.length}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => finish(true)}>
              Saltar
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={next}>
              {stepIdx >= STEPS.length - 1 ? "Listo" : "Siguiente"}
              {stepIdx < STEPS.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
