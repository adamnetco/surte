import { Printer, BarChart3, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Reimprimir el último ticket emitido (Ctrl+P). */
  onReprintLast: () => void;
  canReprint: boolean;
  /** Ventas del día y devoluciones. */
  onSalesOfDay: () => void;
  /** Estado de resoluciones DIAN. */
  onResolutions: () => void;
  /** Tono del chip de resoluciones (ok | warn | error). */
  resolutionTone?: "ok" | "warn" | "error";
  className?: string;
}

/**
 * POSFooterActionsBar — franja inferior de accesos rápidos al estilo del footer
 * de eleventa/SysboPOS: Reimprimir último ticket · Ventas del día y devoluciones ·
 * Resoluciones. Presentación pura (sin acceso a datos), tap targets 44px.
 */
export default function POSFooterActionsBar({
  onReprintLast,
  canReprint,
  onSalesOfDay,
  onResolutions,
  resolutionTone = "ok",
  className,
}: Props) {
  const base =
    "flex-1 min-w-0 h-11 px-2 rounded-md border bg-card text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition [touch-action:manipulation] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className={cn("flex items-stretch gap-1.5", className)}>
      <button
        type="button"
        onClick={onReprintLast}
        disabled={!canReprint}
        className={cn(base, "border-border hover:border-primary hover:text-primary")}
        title="Reimprimir último ticket (Ctrl+P)"
        aria-keyshortcuts="Control+P"
      >
        <Printer className="w-4 h-4 shrink-0" aria-hidden />
        <span className="truncate">Reimprimir último ticket</span>
      </button>

      <button
        type="button"
        onClick={onSalesOfDay}
        className={cn(base, "border-border hover:border-primary hover:text-primary")}
        title="Ventas del día y devoluciones"
      >
        <BarChart3 className="w-4 h-4 shrink-0" aria-hidden />
        <span className="truncate">Ventas del día</span>
      </button>

      <button
        type="button"
        onClick={onResolutions}
        className={cn(
          base,
          resolutionTone === "error"
            ? "border-destructive/40 text-destructive hover:bg-destructive/5"
            : resolutionTone === "warn"
            ? "border-amber-300 text-amber-800 hover:bg-amber-50"
            : "border-border hover:border-primary hover:text-primary",
        )}
        title="Estado de resoluciones DIAN"
      >
        <FileSignature className="w-4 h-4 shrink-0" aria-hidden />
        <span className="truncate">Resoluciones</span>
      </button>
    </div>
  );
}
