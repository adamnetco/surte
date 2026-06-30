import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingCart, Users, Package, Truck, BarChart3, FileText,
  Utensils, ChefHat, CalendarClock, Coins, Boxes, Receipt,
  Plus, MoreHorizontal, BookOpen, Keyboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { POS_MODES, type PosMode } from "@/modules/pos/lib/posModes";


/**
 * POSTopRibbon — barra de navegación iconográfica XL inspirada en
 * SoftwarePOS / VectorPOS / SitricPOS. Reduce a 1 clic el acceso a las
 * secciones operativas más usadas, en lugar de obligar al cajero a
 * abrir sidebar o usar Cmd+K (gap detectado en auditoría vs competencia).
 *
 * Multi-nicho: el set de ítems visibles depende de `currentOrg.business_type`
 * y de los módulos habilitados (`hasModule`). Los ítems no aplicables
 * caen al menú "Más ▾" para no perder acceso pero sin saturar.
 *
 * Cada item declara un `hotkey` (F2..F12) — el binding global vive en
 * `usePOSHotkeys`; este componente solo lo muestra como pista visual.
 */
type BusinessType = "retail" | "food" | "hybrid" | "services" | "pharmacy" | "fx" | string;

interface RibbonItem {
  key: string;
  label: string;
  to: string;
  Icon: LucideIcon;
  hotkey?: string;
  /** Tipos de negocio donde el item es PRIMARIO (visible en barra). */
  primaryFor: BusinessType[] | "*";
  /** Si requiere módulo activo, su key. */
  requiresModule?: string;
  /** Tono del icono — diferencia visual rápida tipo Action Rail. */
  tone?: "primary" | "success" | "warning" | "info" | "danger" | "muted";
}

// Patrón industria-estándar (Square / Toast / Lightspeed / Loyverse):
// SPA single-window con estado de ticket persistido (Dexie en
// POSWorkspace via `ticketCacheKey`). Toda navegación es in-app —
// volver a /pos/vender restaura el ticket exactamente como estaba.
// No usamos pestañas nuevas: rompen el flujo desktop y desincronizan
// el contexto de turno/caja/impresora.
const ALL_ITEMS: RibbonItem[] = [
  { key: "sell",      label: "Vender",     to: "/pos/vender",         Icon: ShoppingCart,  hotkey: "F2", primaryFor: "*",                              tone: "primary" },
  { key: "tables",    label: "Mesas",      to: "/mesas",              Icon: Utensils,      hotkey: "F5", primaryFor: ["food"],                          requiresModule: "dining_tables", tone: "success" },
  { key: "kds",       label: "Cocina",     to: "/kds",                Icon: ChefHat,                  primaryFor: ["food"],                          requiresModule: "kds",           tone: "warning" },
  { key: "agenda",    label: "Agenda",     to: "/reservas",           Icon: CalendarClock,            primaryFor: ["food", "services"],                                               tone: "info" },
  { key: "clients",   label: "Clientes",   to: "/admin?tab=clientes", Icon: Users,         hotkey: "F3", primaryFor: "*",                                                            tone: "info" },
  { key: "products",  label: "Artículos",  to: "/admin?tab=productos",Icon: Package,       hotkey: "F4", primaryFor: ["retail","food","hybrid","pharmacy"],                          tone: "muted" },
  { key: "inventory", label: "Inventario", to: "/inventario",         Icon: Boxes,                  primaryFor: ["retail","food","hybrid","pharmacy"],                          tone: "muted" },
  { key: "purchases", label: "Compras",    to: "/compras",            Icon: Truck,         hotkey: "F6", primaryFor: ["retail","food","hybrid","pharmacy"],                          tone: "muted" },
  { key: "reports",   label: "Reportes",   to: "/admin/reportes",     Icon: BarChart3,     hotkey: "F7", primaryFor: "*",                                                            tone: "info" },
  { key: "billing",   label: "Facturación",to: "/facturacion",        Icon: FileText,                 primaryFor: ["retail","food","hybrid","services","pharmacy"],                tone: "muted" },
  { key: "accounting",label: "Contabilidad",to: "/admin/contabilidad",Icon: BookOpen,                 primaryFor: ["hybrid"],                                                       tone: "muted" },
  { key: "fx",        label: "Cambios",    to: "/casas-de-cambio",    Icon: Coins,                    primaryFor: ["fx"],                                                            tone: "warning" },
  { key: "cash",      label: "Caja",       to: "/pos",                Icon: Receipt,       hotkey: "F8", primaryFor: "*",                                                            tone: "danger" },
];


const TONE_BG: Record<NonNullable<RibbonItem["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info:    "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  danger:  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  muted:   "bg-muted text-muted-foreground",
};

interface Props {
  /** Acción inline tipo "Cliente Nuevo +" / "Artículo Nuevo +" (Quick Create). */
  onQuickCreate?: () => void;
  /** Abre el cheat-sheet de atajos del POS. */
  onShowHotkeys?: () => void;
  className?: string;
  /** Modo de venta activo + alternativas — relocalizado desde el POSModeBar
   *  para recuperar ~72px verticales en el catálogo. */
  modes?: PosMode[];
  activeMode?: PosMode;
  onChangeMode?: (m: PosMode) => void;
}

export default function POSTopRibbon({ onQuickCreate, onShowHotkeys, className, modes, activeMode, onChangeMode }: Props) {

  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrg, hasModule } = useOrganization();
  const businessType = (currentOrg?.business_type ?? "retail") as BusinessType;

  const { primary, overflow } = useMemo(() => {
    const visible = ALL_ITEMS.filter(
      (i) => !i.requiresModule || hasModule(i.requiresModule),
    );
    const isPrimary = (i: RibbonItem) =>
      i.primaryFor === "*" || i.primaryFor.includes(businessType);
    return {
      primary: visible.filter(isPrimary),
      overflow: visible.filter((i) => !isPrimary(i)),
    };
  }, [businessType, hasModule]);

  const isActive = (to: string) => {
    const path = to.split("?")[0];
    return location.pathname === path;
  };

  return (
    <nav
      aria-label="Acceso rápido POS"
      className={cn(
        "sticky top-12 z-20 bg-card/95 backdrop-blur border-b",
        "px-2 py-1.5",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {modes && modes.length > 1 && activeMode && onChangeMode && (
          <div
            role="group"
            aria-label="Modo de venta"
            className="shrink-0 flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5 mr-1"
          >
            {modes.map((m) => {
              const meta = POS_MODES[m];
              const MIcon = meta.icon;
              const isActive = activeMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChangeMode(m)}
                  aria-pressed={isActive}
                  title={meta.description}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-[50px] px-2.5 rounded-md text-xs font-semibold transition",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  <MIcon className="w-4 h-4" aria-hidden />
                  <span className="hidden md:inline">{meta.short}</span>
                </button>
              );
            })}
          </div>
        )}

        {primary.map((item) => {
          const active = isActive(item.to);
          const tone = item.tone ?? "muted";
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.to)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative shrink-0 flex flex-col items-center justify-center gap-0.5",
                "min-w-[72px] h-[58px] px-2 rounded-lg border transition",
                "hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "border-primary bg-primary/5" : "border-border",
              )}
              title={item.hotkey ? `${item.label} (${item.hotkey})` : item.label}
            >
              <span className={cn("w-7 h-7 rounded-md grid place-items-center", TONE_BG[tone])}>
                <item.Icon className="w-4 h-4" aria-hidden />
              </span>
              <span className="text-[11px] leading-none font-medium text-foreground">
                {item.label}
              </span>
              {item.hotkey && (
                <span className="text-[9px] leading-none text-muted-foreground tabular-nums">
                  {item.hotkey}
                </span>
              )}
            </button>
          );
        })}

        {overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 flex flex-col items-center justify-center gap-0.5 min-w-[60px] h-[58px] px-2 rounded-lg border border-border hover:border-primary/60"
                title="Más opciones"
              >
                <span className="w-7 h-7 rounded-md grid place-items-center bg-muted text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" aria-hidden />
                </span>
                <span className="text-[11px] leading-none font-medium">Más</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((it) => (
                <DropdownMenuItem
                  key={it.key}
                  onSelect={() => {
                    if (it.openInNewTab) {
                      window.open(it.to, "_blank", "noopener,noreferrer");
                    } else {
                      navigate(it.to);
                    }
                  }}
                >
                  <it.Icon className="w-4 h-4 mr-2" /> {it.label}
                  {it.openInNewTab && <span className="ml-auto text-[10px] text-muted-foreground">↗</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}


        <div className="flex-1" />

        {onQuickCreate && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-9 gap-1.5"
            onClick={onQuickCreate}
            title="Crear cliente, artículo o proveedor sin salir del POS"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        )}

        {onShowHotkeys && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 h-9 w-9 p-0"
            onClick={onShowHotkeys}
            title="Atajos de teclado (?)"
            aria-label="Atajos de teclado"
          >
            <Keyboard className="w-4 h-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
