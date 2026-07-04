import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, StickyNote, Percent } from "lucide-react";

export interface TicketLineData {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  total: number;
  notes?: string;
  discountPct?: number;
  addedAt: number;
}

interface Props {
  line: TicketLineData;
  onQty: (delta: number) => void;
  onRemove: () => void;
  onNotes: (notes: string) => void;
  onDiscount: (pct: number) => void;
  selected?: boolean;
  onSelect?: () => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const QUICK_NOTES = ["Sin cebolla", "Sin sal", "Sin picante", "Para llevar", "Bien cocido", "Término medio"];

export default function TicketLineRow({ line, onQty, onRemove, onNotes, onDiscount, selected, onSelect }: Props) {
  const [noteDraft, setNoteDraft] = useState(line.notes ?? "");
  const [discDraft, setDiscDraft] = useState(String(line.discountPct ?? 0));
  const hasNote = !!line.notes?.trim();
  const hasDisc = (line.discountPct ?? 0) > 0;
  const finalTotal = hasDisc ? line.total * (1 - (line.discountPct ?? 0) / 100) : line.total;

  // ===== Táctil: swipe-left para eliminar + long-press para seleccionar =====
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SWIPE_TRIGGER = 96;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    setDragging(true);
    longPressTimer.current = setTimeout(() => {
      try { navigator.vibrate?.(15); } catch { /* noop */ }
      onSelect?.();
      longPressTimer.current = null;
    }, 380);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = Math.abs(t.clientY - touchStartY.current);
    if (dy > 12) clearLongPress();
    if (dx < 0) setDragX(Math.max(dx, -140));
  };
  const onTouchEnd = () => {
    clearLongPress();
    setDragging(false);
    if (dragX <= -SWIPE_TRIGGER) {
      try { navigator.vibrate?.(20); } catch { /* noop */ }
      onRemove();
    }
    setDragX(0);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      {/* Fondo revelado al deslizar */}
      <div
        aria-hidden
        className={`absolute inset-0 flex items-center justify-end pr-4 rounded-md bg-destructive text-destructive-foreground transition-opacity ${
          dragX < -8 ? "opacity-100" : "opacity-0"
        }`}
      >
        <Trash2 className="w-5 h-5" />
        <span className="ml-2 text-xs font-bold">Eliminar</span>
      </div>

      <div
        className={`relative group rounded-md border bg-card px-2 py-1.5 animate-fade-in focus:outline-none touch-pan-y ${
          !dragging ? "transition-[transform,box-shadow,border-color]" : ""
        } ${
          selected
            ? "border-primary ring-1 ring-primary/40 bg-primary/5"
            : "border-border hover:border-border/80 focus-within:ring-1 focus-within:ring-ring"
        }`}
        style={{ transform: `translateX(${dragX}px)` }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={onSelect}
        role="group"
        aria-label={`${line.name}, cantidad ${line.quantity}. Desliza a la izquierda para eliminar.`}
      >
      <div className="flex items-center gap-2">
        {/* Nombre + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-tight truncate">{line.name}</p>
          <p className="text-[10px] text-muted-foreground leading-tight tabular-nums">
            {line.quantity} × {COP(line.unitPrice)}
            {hasDisc && <span className="ml-1 text-accent font-semibold">−{line.discountPct}%</span>}
          </p>
        </div>

        {/* Stepper compacto — targets táctiles h-9 (36px), zona activa aún mayor por padding del row */}
        <div className="flex items-center rounded-md border border-border overflow-hidden bg-background">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onQty(-1); }}
            aria-label="Reducir"
            className="h-9 w-9 grid place-items-center text-muted-foreground hover:bg-muted transition touch-manipulation active:bg-muted/70"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center text-[13px] font-bold tabular-nums" aria-live="polite">
            {line.quantity}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onQty(1); }}
            aria-label="Aumentar"
            className="h-9 w-9 grid place-items-center text-muted-foreground hover:bg-muted transition touch-manipulation active:bg-muted/70"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Total */}
        <div className="w-[72px] text-right shrink-0">
          {hasDisc && (
            <p className="text-[9px] text-muted-foreground line-through tabular-nums leading-none">{COP(line.total)}</p>
          )}
          <p className="text-[13px] font-bold tabular-nums leading-tight">{COP(finalTotal)}</p>
        </div>

        {/* Acciones icon-only */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={hasNote ? "Editar nota" : "Añadir nota"}
                className={`h-7 w-7 grid place-items-center rounded transition ${
                  hasNote ? "text-accent bg-accent/15" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <StickyNote className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72 p-3 space-y-2">
              <p className="text-xs font-semibold">Nota para cocina</p>
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 140))}
                placeholder="Ej. Sin sal, término medio…"
                rows={2}
                className="text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {QUICK_NOTES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setNoteDraft((p) => (p ? p + ", " + q : q).slice(0, 140))}
                    className="text-[10px] px-1.5 py-0.5 rounded-full border bg-muted hover:bg-accent/20"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">{noteDraft.length}/140</span>
                <Button size="sm" className="h-7 text-xs" onClick={() => onNotes(noteDraft.trim())}>
                  Guardar
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={hasDisc ? `Descuento ${line.discountPct}%` : "Descuento"}
                className={`h-7 min-w-[28px] px-1 grid place-items-center rounded transition text-[10px] font-semibold ${
                  hasDisc ? "text-accent bg-accent/15" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {hasDisc ? `${line.discountPct}%` : <Percent className="w-3.5 h-3.5" />}
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-56 p-3 space-y-2">
              <p className="text-xs font-semibold">Descuento (%)</p>
              <Input
                type="number"
                min={0}
                max={100}
                value={discDraft}
                onChange={(e) => setDiscDraft(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="grid grid-cols-4 gap-1">
                {[0, 5, 10, 15, 20, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDiscDraft(String(v))}
                    className="text-[10px] py-1 rounded border bg-muted hover:bg-accent/20"
                  >
                    {v}%
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => {
                  const v = Math.max(0, Math.min(100, Number(discDraft) || 0));
                  onDiscount(v);
                }}
              >
                Aplicar
              </Button>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`Eliminar ${line.name}`}
            className="h-7 w-7 grid place-items-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hasNote && (
        <p className="mt-1 text-[10px] italic text-accent-foreground bg-accent/10 rounded px-1.5 py-0.5 truncate">
          {line.notes}
        </p>
      )}
      </div>
    </div>
  );
}

