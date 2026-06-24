/**
 * POSRightRail — mini-rail vertical fijo (56px) con atajos de alta frecuencia.
 * Mantiene las mismas acciones del Sheet de POSTopBar (Cierre Z, Atajos) y suma
 * accesos rápidos pedidos por operación: Suspender, Notas Crédito/Devolución,
 * Ventas del día, Cajón monedero y Refrescar sync.
 *
 * - Visible md:flex (tablet/desktop). En móvil se queda el Sheet del TopBar
 *   para no robar ancho útil del catálogo.
 * - No duplica estado: recibe handlers del workspace.
 * - Tooltip nativo (title) + aria-label en cada botón.
 */
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Keyboard,
  Pause,
  Receipt,
  BarChart3,
  Wallet,
  RefreshCw,
} from "lucide-react";

interface Props {
  onCloseShift: () => void;
  onOpenShortcuts: () => void;
  onPark: () => void;
  onNotasCredito: () => void;
  onVentasDelDia: () => void;
  onCajon: () => void;
  onRefresh: () => void;
  parkDisabled?: boolean;
  syncing?: boolean;
  pendingCount?: number;
}

interface Item {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "destructive";
  badge?: number;
}

export default function POSRightRail({
  onCloseShift,
  onOpenShortcuts,
  onPark,
  onNotasCredito,
  onVentasDelDia,
  onCajon,
  onRefresh,
  parkDisabled,
  syncing,
  pendingCount = 0,
}: Props) {
  const items: Item[] = [
    { key: "park", label: "Suspender ticket (F8)", icon: Pause, onClick: onPark, disabled: parkDisabled },
    { key: "nc", label: "Notas crédito / Devolución", icon: Receipt, onClick: onNotasCredito },
    { key: "ventas", label: "Ventas del día", icon: BarChart3, onClick: onVentasDelDia },
    { key: "cajon", label: "Abrir cajón monedero", icon: Wallet, onClick: onCajon },
    { key: "refresh", label: pendingCount > 0 ? `Sincronizar (${pendingCount})` : "Refrescar", icon: RefreshCw, onClick: onRefresh, badge: pendingCount },
    { key: "shortcuts", label: "Atajos de teclado (?)", icon: Keyboard, onClick: onOpenShortcuts },
    { key: "close", label: "Cierre Z de caja", icon: LogOut, onClick: onCloseShift, tone: "destructive" },
  ];

  return (
    <aside
      aria-label="Atajos rápidos del POS"
      className="hidden md:flex w-14 shrink-0 flex-col items-center gap-1 border-l bg-card py-2"
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Button
            key={it.key}
            variant="ghost"
            size="icon"
            className={`relative h-11 w-11 rounded-md ${
              it.tone === "destructive" ? "text-destructive hover:text-destructive" : ""
            }`}
            onClick={it.onClick}
            disabled={it.disabled}
            title={it.label}
            aria-label={it.label}
          >
            <Icon className={`h-[18px] w-[18px] ${it.key === "refresh" && syncing ? "animate-spin" : ""}`} />
            {!!it.badge && it.badge > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white grid place-items-center"
                aria-hidden="true"
              >
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            )}
          </Button>
        );
      })}
    </aside>
  );
}
