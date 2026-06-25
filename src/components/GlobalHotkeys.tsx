import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

/**
 * Ola 6 — Slice A: Atajos de teclado globales
 *
 * Secuencias estilo Gmail/Linear (presiona G y luego letra):
 *   g d → /admin/diario
 *   g p → /pos
 *   g i → /admin?tab=inventory
 *   g o → /admin?tab=orders
 *   g u → /admin?tab=usuarios
 *   g s → /admin?tab=settings
 *   g a → /admin
 *
 * Atajos simples:
 *   n  → Nuevo pedido (abre ⌘K con query "nuevo")
 *   r  → Refrescar página actual (dispatch sps:refresh)
 *   ?  → Cheatsheet
 *
 * No dispara cuando:
 *  - focus en input/textarea/contenteditable o dentro de [cmdk-root]
 *  - ruta empieza con /pos (POS tiene sus propios hotkeys)
 *  - tecla viene con ctrl/meta/alt (excepto Shift+? que es el cheatsheet)
 */

type HotkeyDef = {
  combo: string;
  label: string;
  group: "Navegación" | "Acciones" | "Ayuda";
  run: (ctx: { navigate: ReturnType<typeof useNavigate> }) => void;
};

const HOTKEYS: Record<string, HotkeyDef> = {
  "g d": { combo: "G D", label: "Ir al Diario", group: "Navegación", run: ({ navigate }) => navigate("/admin/diario") },
  "g p": { combo: "G P", label: "Ir al POS", group: "Navegación", run: ({ navigate }) => navigate("/pos") },
  "g a": { combo: "G A", label: "Ir al Admin", group: "Navegación", run: ({ navigate }) => navigate("/admin") },
  "g i": { combo: "G I", label: "Inventario", group: "Navegación", run: ({ navigate }) => navigate("/admin?tab=inventory") },
  "g o": { combo: "G O", label: "Pedidos", group: "Navegación", run: ({ navigate }) => navigate("/admin?tab=orders") },
  "g u": { combo: "G U", label: "Usuarios", group: "Navegación", run: ({ navigate }) => navigate("/admin?tab=usuarios") },
  "g s": { combo: "G S", label: "Configuración", group: "Navegación", run: ({ navigate }) => navigate("/admin?tab=settings") },
  n: {
    combo: "N",
    label: "Nuevo pedido (abre ⌘K)",
    group: "Acciones",
    run: () => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const ev = new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      });
      window.dispatchEvent(ev);
    },
  },
  r: {
    combo: "R",
    label: "Refrescar datos",
    group: "Acciones",
    run: () => window.dispatchEvent(new CustomEvent("sps:refresh")),
  },
  "?": {
    combo: "?",
    label: "Mostrar atajos",
    group: "Ayuda",
    run: () => window.dispatchEvent(new CustomEvent("sps:hotkeys:open")),
  },
};

const USAGE_KEY = "sistecpos:hotkeys:usage";
const G_TIMEOUT_MS = 1200;

function bumpUsage(combo: string) {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    data[combo] = (data[combo] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getTopHotkeys(limit = 3): { combo: string; label: string; count: number }[] {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Record<string, number>;
    return Object.entries(data)
      .map(([combo, count]) => ({ combo, count, label: Object.values(HOTKEYS).find((h) => h.combo === combo)?.label ?? combo }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export default function GlobalHotkeys() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cheatOpen, setCheatOpen] = useState(false);

  const isEditable = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.closest?.("[cmdk-root]")) return true;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }, []);

  useEffect(() => {
    const onOpen = () => setCheatOpen(true);
    window.addEventListener("sps:hotkeys:open", onOpen);
    return () => window.removeEventListener("sps:hotkeys:open", onOpen);
  }, []);

  useEffect(() => {
    let gPending = false;
    let gTimer: number | null = null;

    const clearG = () => {
      gPending = false;
      if (gTimer) {
        window.clearTimeout(gTimer);
        gTimer = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (location.pathname.startsWith("/pos")) return;
      if (isEditable(e.target)) return;
      // ? requires shift; everything else: no modifiers
      const isQuestion = e.key === "?";
      if (!isQuestion && (e.ctrlKey || e.metaKey || e.altKey)) return;

      const key = e.key.toLowerCase();

      // Secuencia G + letra
      if (gPending) {
        const combo = `g ${key}`;
        const def = HOTKEYS[combo];
        clearG();
        if (def) {
          e.preventDefault();
          bumpUsage(def.combo);
          def.run({ navigate });
        }
        return;
      }

      if (key === "g") {
        gPending = true;
        gTimer = window.setTimeout(clearG, G_TIMEOUT_MS);
        return;
      }

      // Atajos simples
      const single = HOTKEYS[isQuestion ? "?" : key];
      if (single) {
        e.preventDefault();
        bumpUsage(single.combo);
        single.run({ navigate });
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearG();
    };
  }, [navigate, location.pathname, isEditable]);

  const grouped = Object.values(HOTKEYS).reduce<Record<string, HotkeyDef[]>>((acc, h) => {
    (acc[h.group] ||= []).push(h);
    return acc;
  }, {});

  return (
    <Dialog open={cheatOpen} onOpenChange={setCheatOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atajos de teclado
          </DialogTitle>
          <DialogDescription>Acelera tu día con atajos estilo Linear/Gmail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group}</h4>
              <ul className="space-y-1.5">
                {items.map((h) => (
                  <li key={h.combo} className="flex items-center justify-between text-sm">
                    <span>{h.label}</span>
                    <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                      {h.combo}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground border-t border-border">
            Presiona <kbd className="rounded border border-border bg-muted px-1.5 font-mono">?</kbd> en cualquier momento para abrir esta lista.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
