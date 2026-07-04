import { useState } from "react";
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); onQty(1); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); onQty(-1); }
    else if (e.key === "Delete" || (e.key === "Backspace" && e.shiftKey)) { e.preventDefault(); onRemove(); }
  };

  return (
    <div
      className={`group relative rounded-md border bg-card px-2 py-1.5 animate-fade-in focus:outline-none transition ${
        selected
          ? "border-primary ring-1 ring-primary/40 bg-primary/5"
          : "border-border hover:border-border/80 focus-within:ring-1 focus-within:ring-ring"
      }`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={onSelect}
      role="group"
      aria-label={`${line.name}, cantidad ${line.quantity}`}
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

        {/* Stepper compacto */}
        <div className="flex items-center rounded-md border border-border overflow-hidden bg-background">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onQty(-1); }}
            aria-label="Reducir"
            className="h-7 w-7 grid place-items-center text-muted-foreground hover:bg-muted transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-7 text-center text-[12px] font-bold tabular-nums" aria-live="polite">
            {line.quantity}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onQty(1); }}
            aria-label="Aumentar"
            className="h-7 w-7 grid place-items-center text-muted-foreground hover:bg-muted transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Total */}
        <div className="w-[70px] text-right shrink-0">
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
  );
}
