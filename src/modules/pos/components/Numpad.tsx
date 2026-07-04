import { Delete } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Presets tocables encima del pad (ej. billetes exactos, %) */
  presets?: { label: string; value: number | string; highlight?: boolean }[];
  /** Aceptar decimales (coma o punto). Default false para POS Colombia. */
  allowDecimal?: boolean;
  /** Máximo de dígitos enteros. Default 9. */
  maxDigits?: number;
  /** Texto del botón de acción principal (ej. "Confirmar", "OK"). */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  /** Modo compacto para caber junto a otro contenido. */
  compact?: boolean;
}

/**
 * Numpad táctil para POS. Reemplaza teclado del sistema en operaciones frecuentes:
 * cantidad, descuento, monto recibido, propina custom.
 *
 * Diseñado con targets ≥56px para pulgar. Retorna string (no number) para no perder
 * el estado intermedio de tecleo (ej. usuario escribe "1" antes de "10").
 */
export default function Numpad({
  value,
  onChange,
  presets,
  allowDecimal = false,
  maxDigits = 9,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  compact = false,
}: Props) {
  const btn =
    "select-none active:scale-95 transition-transform touch-manipulation " +
    "font-heading font-semibold tabular-nums bg-card border border-border rounded-lg " +
    "hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const size = compact ? "h-12 text-lg" : "h-14 text-xl";

  const push = (ch: string) => {
    if (ch === "." || ch === ",") {
      if (!allowDecimal) return;
      if (value.includes(".") || value.includes(",")) return;
      onChange((value || "0") + ".");
      return;
    }
    const digits = value.replace(/[^0-9]/g, "");
    if (digits.length >= maxDigits) return;
    const next = value === "0" ? ch : value + ch;
    onChange(next);
  };
  const backspace = () => onChange(value.length <= 1 ? "" : value.slice(0, -1));
  const clear = () => onChange("");
  const triHap = () => { try { navigator.vibrate?.(4); } catch { /* noop */ } };

  const keys: (string | "back" | "clr" | "dot")[] = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    allowDecimal ? "dot" : "clr", "0", "back",
  ];

  return (
    <div className="flex flex-col gap-2 w-full">
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={String(p.value) + p.label}
              type="button"
              onClick={() => { triHap(); onChange(String(p.value)); }}
              className={`px-3 h-11 rounded-lg border text-xs font-bold tabular-nums touch-manipulation active:scale-95 transition ${
                p.highlight
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-muted border-border hover:bg-accent/20"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {keys.map((k) => {
          if (k === "back") {
            return (
              <button
                key="back"
                type="button"
                onClick={() => { triHap(); backspace(); }}
                onContextMenu={(e) => { e.preventDefault(); clear(); }}
                aria-label="Borrar último dígito (mantener para limpiar)"
                className={`${btn} ${size} text-muted-foreground grid place-items-center`}
              >
                <Delete className="w-6 h-6" />
              </button>
            );
          }
          if (k === "clr") {
            return (
              <button
                key="clr"
                type="button"
                onClick={() => { triHap(); clear(); }}
                aria-label="Limpiar"
                className={`${btn} ${size} text-muted-foreground`}
              >
                C
              </button>
            );
          }
          if (k === "dot") {
            return (
              <button
                key="dot"
                type="button"
                onClick={() => { triHap(); push("."); }}
                className={`${btn} ${size} text-muted-foreground`}
              >
                ,
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              onClick={() => { triHap(); push(k); }}
              className={`${btn} ${size}`}
            >
              {k}
            </button>
          );
        })}
      </div>

      {confirmLabel && onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="h-14 rounded-lg bg-accent text-accent-foreground font-heading font-bold text-base touch-manipulation active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
}
