/**
 * POSActionRail — strip de acciones rápidas coloreadas estilo VectorPOS.
 * Opera sobre la línea seleccionada del ticket (selectedLineId en POSWorkspace).
 * Cada acción tiene su color funcional para reconocimiento instantáneo en pantalla táctil.
 *
 * Acciones:
 *  - Multiplicar (azul):  prompt → setQty absoluto
 *  - Cortar (ámbar):      qty - 1 (decrementa rápido)
 *  - Comentario (violeta): prompt → setNotes
 *  - Descuento (verde):   prompt 0-100 → setDiscount
 *  - Borrar (rojo):       remove confirmado
 *
 * Cuando no hay línea seleccionada, los botones quedan deshabilitados pero
 * visibles para que el cajero entienda qué puede hacer al tocar una línea.
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
    {
      key: "mul", label: "×Cant", icon: X, onClick: onMultiply,
      classes: "bg-sky-500/15 text-sky-700 border-sky-500/40 hover:bg-sky-500/25 dark:text-sky-300",
    },
    {
      key: "cut", label: "Cortar", icon: Scissors, onClick: onCut,
      classes: "bg-amber-500/15 text-amber-700 border-amber-500/40 hover:bg-amber-500/25 dark:text-amber-300",
    },
    {
      key: "note", label: "Nota", icon: MessageSquare, onClick: onComment,
      classes: "bg-violet-500/15 text-violet-700 border-violet-500/40 hover:bg-violet-500/25 dark:text-violet-300",
    },
    {
      key: "disc", label: "Desc.", icon: Percent, onClick: onDiscount,
      classes: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/25 dark:text-emerald-300",
    },
    {
      key: "del", label: "Borrar", icon: Trash2, onClick: onDelete,
      classes: "bg-rose-500/15 text-rose-700 border-rose-500/40 hover:bg-rose-500/25 dark:text-rose-300",
    },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Acciones sobre línea seleccionada"
      className="grid grid-cols-5 gap-1 px-2.5 py-2 border-b bg-muted/30"
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.key}
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={a.onClick}
            title={hasSelection ? a.label : "Selecciona una línea del ticket"}
            aria-label={a.label}
            className={`h-12 flex-col gap-0.5 px-1 border ${a.classes} disabled:opacity-40 disabled:hover:bg-transparent`}
          >
            <Icon className="!w-4 !h-4" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide leading-none">{a.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
