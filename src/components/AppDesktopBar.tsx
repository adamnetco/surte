import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Home, MoreVertical, Settings, Lock,
  LogOut, HelpCircle, Building2, ShoppingBag, LayoutDashboard, Shield,
  Minus, Square, X, Keyboard, Activity,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ROUTE_LABELS } from "@/lib/routeLabels";
import { getDesktopBridge } from "@/infrastructure/desktop/ElectronDesktopBridge";
import { cn } from "@/lib/utils";

/**
 * AppDesktopBar — barra superior global tipo aplicación de escritorio.
 *
 * Persistente en toda la app. Aporta:
 *   • Navegación (atrás / adelante / inicio)
 *   • Título + ruta actual
 *   • Menú global (⋮) con acciones cross-módulo
 *   • Botón Config
 *   • Window controls (solo si corre bajo Electron)
 *
 * Altura fija de 36px. Publica `--app-bar-h` en `:root` para que las pantallas
 * `100dvh` (POSWorkspace) puedan descontar el offset.
 */
const BAR_HEIGHT_PX = 36;

function routeTitle(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return ROUTE_LABELS[""] ?? "Inicio";
  // Toma el último segmento reconocido; fallback al último crudo.
  for (let i = segs.length - 1; i >= 0; i--) {
    const label = ROUTE_LABELS[segs[i]];
    if (label) return label;
  }
  const last = segs[segs.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
}

export default function AppDesktopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const desktop = getDesktopBridge();
  const runningInElectron = desktop.isDesktop;
  const bridge = desktop.getWindowControls();

  // Publica altura como CSS var y limpia al desmontar.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-bar-h", `${BAR_HEIGHT_PX}px`);
    return () => { document.documentElement.style.removeProperty("--app-bar-h"); };
  }, []);

  // Heurística de historial: React Router no expone el índice.
  // Usamos window.history.length + un contador de navegaciones dentro del SPA.
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
    setCanGoForward(false); // se actualiza al usar "atrás"
  }, [location.pathname]);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge.isMaximized().then((v) => { if (!cancelled) setMaximized(v); }).catch(() => {});
    const off = bridge.onMaximizeChange(setMaximized);
    return () => { cancelled = true; off(); };
  }, [bridge]);

  const goBack = () => { navigate(-1); setCanGoForward(true); };
  const goForward = () => navigate(1);
  const goHome = () => navigate("/");

  const openShortcuts = () => window.dispatchEvent(new CustomEvent("app:open-shortcuts"));
  const openStatus = () => window.dispatchEvent(new CustomEvent("app:open-status"));
  const lockScreen = () => window.dispatchEvent(new CustomEvent("pin-lock:lock"));

  const signOut = async () => {
    try { await supabase.auth.signOut(); toast.success("Sesión cerrada"); navigate("/login"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo cerrar sesión"); }
  };

  const title = routeTitle(location.pathname);
  const path = location.pathname;

  return (
    <header
      role="banner"
      aria-label="Barra de aplicación"
      style={{ height: BAR_HEIGHT_PX, WebkitAppRegion: runningInElectron ? "drag" : undefined } as React.CSSProperties}
      className="sticky top-0 z-[60] w-full bg-background/95 backdrop-blur-md border-b border-border flex items-center gap-1 px-1 select-none"
    >
      {/* Grupo izquierdo: navegación */}
      <div
        className="flex items-center gap-0.5 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <BarButton onClick={goBack} disabled={!canGoBack} title="Atrás (Alt+←)" ariaLabel="Volver atrás">
          <ArrowLeft className="w-4 h-4" />
        </BarButton>
        <BarButton onClick={goForward} disabled={!canGoForward} title="Adelante (Alt+→)" ariaLabel="Adelante">
          <ArrowRight className="w-4 h-4" />
        </BarButton>
        <BarButton onClick={goHome} title="Inicio" ariaLabel="Ir a inicio">
          <Home className="w-4 h-4" />
        </BarButton>
      </div>

      {/* Título + breadcrumb — zona arrastrable en Electron */}
      <div className="flex-1 min-w-0 flex items-center gap-2 px-2 text-xs">
        <span className="font-bold text-primary tracking-tight">SistecPOS</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground truncate font-medium" title={path}>{title}</span>
        <span className="hidden sm:inline text-muted-foreground/40 font-mono truncate">{path}</span>
      </div>

      {/* Grupo derecho: settings + menú + window controls */}
      <div
        className="flex items-center gap-0.5 shrink-0"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <BarButton onClick={() => navigate("/configuracion")} title="Configuración" ariaLabel="Abrir configuración">
          <Settings className="w-4 h-4" />
        </BarButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menú de aplicación"
              title="Más opciones"
              className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Ir a</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/pos/vender")}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Punto de Venta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <LayoutDashboard className="w-4 h-4 mr-2" /> Administración
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/superadmin")}>
              <Shield className="w-4 h-4 mr-2" /> Superadmin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/clientes")}>
              <Building2 className="w-4 h-4 mr-2" /> Portal cliente
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Ayuda</DropdownMenuLabel>
            <DropdownMenuItem onClick={openShortcuts}>
              <Keyboard className="w-4 h-4 mr-2" /> Atajos de teclado
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">F1</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openStatus}>
              <Activity className="w-4 h-4 mr-2" /> Estado del sistema
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/ayuda")}>
              <HelpCircle className="w-4 h-4 mr-2" /> Centro de ayuda
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={lockScreen}>
              <Lock className="w-4 h-4 mr-2" /> Bloquear pantalla
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">Ctrl+L</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Window controls — visibles solo bajo Electron */}
        {runningInElectron && bridge && (
          <div className="flex items-center ml-1 border-l border-border pl-1">
            <BarButton onClick={() => bridge.minimize()} title="Minimizar" ariaLabel="Minimizar ventana">
              <Minus className="w-3.5 h-3.5" />
            </BarButton>
            <BarButton
              onClick={() => bridge.toggleMaximize()}
              title={maximized ? "Restaurar" : "Maximizar"}
              ariaLabel={maximized ? "Restaurar ventana" : "Maximizar ventana"}
            >
              <Square className="w-3.5 h-3.5" />
            </BarButton>
            <button
              type="button"
              onClick={() => bridge.close()}
              aria-label="Cerrar ventana"
              title="Cerrar"
              className="h-8 w-10 inline-flex items-center justify-center rounded hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function BarButton({
  onClick, disabled, title, ariaLabel, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-muted active:scale-95",
      )}
    >
      {children}
    </button>
  );
}
