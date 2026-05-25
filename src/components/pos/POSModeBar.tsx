import { POS_MODES, type PosMode } from "@/lib/posModes";
import { cn } from "@/lib/utils";

interface Props {
  modes: PosMode[];
  active: PosMode;
  onChange: (m: PosMode) => void;
  /** Pequeño badge a la derecha (ej. CAJA ABIERTA) */
  rightSlot?: React.ReactNode;
}

/**
 * Barra de modos de venta tipo "minimalist underline tabs".
 * Inspirada en flujos sin fricción de Gamasoft: el cajero declara el contexto
 * (Mesa, Autoservicio, Domicilio, Consumo interno) ANTES de armar el ticket.
 * Solo se muestran los modos habilitados por el admin para el negocio.
 */
export default function POSModeBar({ modes, active, onChange, rightSlot }: Props) {
  if (modes.length <= 1) return null;
  return (
    <nav
      className="sticky top-0 z-20 w-full h-[72px] bg-card border-b border-border flex items-center px-2 sm:px-4"
      aria-label="Modo de venta"
    >
      <div className="flex h-full flex-1 gap-1">
        {modes.map((key) => {
          const meta = POS_MODES[key];
          const Icon = meta.icon;
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-pressed={isActive}
              className={cn(
                "relative flex-1 min-w-[72px] flex flex-col items-center justify-center gap-1 rounded-md transition-all group border-b-[3px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-accent/10 border-accent shadow-[inset_0_1px_0_hsl(var(--accent)/0.25)]"
                  : "border-transparent hover:bg-muted/60"
              )}
              title={meta.description}
            >
              <Icon
                className={cn(
                  "w-6 h-6 transition-colors",
                  isActive ? "text-accent" : "text-muted-foreground group-hover:text-primary"
                )}
                strokeWidth={2.5}
              />
              <span
                className={cn(
                  "text-[11px] sm:text-[13px] uppercase tracking-wide transition-colors",
                  isActive ? "text-accent font-extrabold" : "text-muted-foreground font-semibold group-hover:text-primary"
                )}
              >
                {meta.short}
              </span>
            </button>
          );
        })}
      </div>

      {rightSlot && (
        <div className="hidden md:flex items-center gap-3 pl-4 border-l border-border ml-2">
          {rightSlot}
        </div>
      )}
    </nav>
  );
}
