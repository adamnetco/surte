/**
 * POSActionRail — strip ultra-compacto (h-8) de acciones rápidas sobre la línea seleccionada.
 * Icon-only con tooltip nativo, color funcional VectorPOS, una sola fila que no roba alto al ticket.
 */
import { Button } from "@/components/ui/button";
import { X, Scissors, MessageSquare, Percent, Trash2 } from "lucide-react";

interface Props {
  hasSelection: boolean;
  onMultiply: () => void;
  onCut: () => void;
  onComment: () => void;
  onDiscount: () => void;
  onDelete: () => void;
}

interface Action {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  classes: string;
}

export default function POSActionRail({
  hasSelection, onMultiply, onCut, onComment, onDiscount, onDelete,
}: Props) {
  const actions: Action[] = [
    { key: "mul",  label: "×Cant",  icon: X,            onClick: onMultiply,
      classes: "text-sky-600 hover:bg-sky-500/15 dark:text-sky-300" },
    { key: "cut",  label: "Cortar", icon: Scissors,     onClick: onCut,
      classes: "text-amber-600 hover:bg-amber-500/15 dark:text-amber-300" },
    { key: "note", label: "Nota",   icon: MessageSquare, onClick: onComment,
      classes: "text-violet-600 hover:bg-violet-500/15 dark:text-violet-300" },
    { key: "disc", label: "Desc.",  icon: Percent,      onClick: onDiscount,
      classes: "text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300" },
    { key: "del",  label: "Borrar", icon: Trash2,       onClick: onDelete,
      classes: "text-rose-600 hover:bg-rose-500/15 dark:text-rose-300" },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Acciones sobre línea seleccionada"
      className="flex items-center justify-between gap-0.5 px-1.5 h-8 border-b bg-muted/30 shrink-0"
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.key}
            type="button"
            variant="ghost"
            size="icon"
            disabled={!hasSelection}
            onClick={a.onClick}
            title={hasSelection ? a.label : `${a.label} — selecciona una línea`}
            aria-label={a.label}
            className={`h-7 w-7 rounded ${a.classes} disabled:opacity-30`}
          >
            <Icon className="!w-3.5 !h-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
