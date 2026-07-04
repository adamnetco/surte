import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Minus, StickyNote, Percent } from "lucide-react";
import Numpad from "./Numpad";

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
  const [discSheetOpen, setDiscSheetOpen] = useState(false);
  const [qtySheetOpen, setQtySheetOpen] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(line.quantity));
  const hasNote = !!line.notes?.trim();
  const hasDisc = (line.discountPct ?? 0) > 0;
  const finalTotal = hasDisc ? line.total * (1 - (line.discountPct ?? 0) / 100) : line.total;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); onQty(1); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); onQty(-1); }
    else if (e.key === "Delete" || (e.key === "Backspace" && e.shiftKey)) { e.preventDefault(); onRemove(); }
  };

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

        {/* Stepper táctil: −/+ h-9, número tappable → Numpad para cantidades grandes */}
        <div className="flex items-center rounded-md border border-border overflow-hidden bg-background">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); try { navigator.vibrate?.(4); } catch { /* noop */ } onQty(-1); }}
            aria-label="Reducir"
            className="h-9 w-9 grid place-items-center text-muted-foreground hover:bg-muted transition touch-manipulation active:bg-muted/70"
          >
            <Minus className="w-4 h-4" />
          </button>
          <Sheet open={qtySheetOpen} onOpenChange={setQtySheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setQtyDraft(String(line.quantity)); }}
                aria-label={`Editar cantidad, actualmente ${line.quantity}`}
                className="h-9 min-w-[36px] px-1 grid place-items-center text-[13px] font-bold tabular-nums hover:bg-muted transition touch-manipulation"
              >
                {line.quantity}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl p-4 pb-6">
              <SheetHeader className="mb-3">
                <SheetTitle className="text-base">Cantidad · {line.name}</SheetTitle>
              </SheetHeader>
              <div className="mb-3 h-16 rounded-lg border bg-muted/30 grid place-items-center text-3xl font-heading font-bold tabular-nums">
                {qtyDraft || "0"}
              </div>
              <Numpad
                value={qtyDraft}
                onChange={setQtyDraft}
                maxDigits={4}
                presets={[
                  { label: "×2", value: 2 },
                  { label: "×5", value: 5 },
                  { label: "×10", value: 10 },
                  { label: "×12", value: 12 },
                ]}
                confirmLabel="Aplicar cantidad"
                confirmDisabled={!qtyDraft || Number(qtyDraft) <= 0}
                onConfirm={() => {
                  const n = Math.max(1, Math.min(9999, Number(qtyDraft) || 1));
                  onQty(n - line.quantity);
                  setQtySheetOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); try { navigator.vibrate?.(4); } catch { /* noop */ } onQty(1); }}
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

          <Sheet open={discSheetOpen} onOpenChange={setDiscSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDiscDraft(String(line.discountPct ?? 0)); }}
                aria-label={hasDisc ? `Descuento ${line.discountPct}%` : "Descuento"}
                className={`h-9 min-w-[36px] px-1.5 grid place-items-center rounded transition text-[11px] font-semibold touch-manipulation ${
                  hasDisc ? "text-accent bg-accent/15" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {hasDisc ? `${line.discountPct}%` : <Percent className="w-4 h-4" />}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-2xl p-4 pb-6">
              <SheetHeader className="mb-3">
                <SheetTitle className="text-base">Descuento · {line.name}</SheetTitle>
              </SheetHeader>
              <div className="mb-3 h-16 rounded-lg border bg-muted/30 grid place-items-center text-3xl font-heading font-bold tabular-nums">
                {discDraft || "0"}%
              </div>
              <Numpad
                value={discDraft}
                onChange={setDiscDraft}
                maxDigits={3}
                presets={[
                  { label: "0%", value: 0 },
                  { label: "5%", value: 5 },
                  { label: "10%", value: 10, highlight: true },
                  { label: "15%", value: 15 },
                  { label: "20%", value: 20 },
                  { label: "50%", value: 50 },
                  { label: "100%", value: 100 },
                ]}
                confirmLabel="Aplicar descuento"
                onConfirm={() => {
                  const v = Math.max(0, Math.min(100, Number(discDraft) || 0));
                  onDiscount(v);
                  setDiscSheetOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>

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

