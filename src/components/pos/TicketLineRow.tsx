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
  discountPct?: number; // 0-100
  addedAt: number;
}

interface Props {
  line: TicketLineData;
  onQty: (delta: number) => void;
  onRemove: () => void;
  onNotes: (notes: string) => void;
  onDiscount: (pct: number) => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const QUICK_NOTES = ["Sin cebolla", "Sin sal", "Sin picante", "Para llevar", "Bien cocido", "Término medio"];

export default function TicketLineRow({ line, onQty, onRemove, onNotes, onDiscount }: Props) {
  const [noteDraft, setNoteDraft] = useState(line.notes ?? "");
  const [discDraft, setDiscDraft] = useState(String(line.discountPct ?? 0));
  const hasNote = !!line.notes?.trim();
  const hasDisc = (line.discountPct ?? 0) > 0;
  const finalTotal = hasDisc ? line.total * (1 - (line.discountPct ?? 0) / 100) : line.total;

  return (
    <div className="bg-muted/40 rounded-lg p-2 space-y-1 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-tight truncate">{line.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {COP(line.unitPrice)} c/u
            {hasDisc && <span className="ml-1 text-accent font-semibold">· -{line.discountPct}%</span>}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onQty(-1)}>
            <Minus className="w-3 h-3" />
          </Button>
          <span className="w-6 text-center text-xs font-bold tabular-nums">{line.quantity}</span>
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => onQty(1)}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <div className="w-20 text-right">
          {hasDisc && <p className="text-[10px] text-muted-foreground line-through tabular-nums">{COP(line.total)}</p>}
          <p className="text-sm font-bold tabular-nums">{COP(finalTotal)}</p>
        </div>
      </div>

      {hasNote && (
        <p className="text-[11px] italic text-accent-foreground bg-accent/15 rounded px-1.5 py-0.5 ml-0.5">
          📝 {line.notes}
        </p>
      )}

      <div className="flex items-center gap-1 -mt-0.5">
        {/* Nota cocina */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={`flex items-center gap-1 text-[10px] px-1.5 h-5 rounded border transition ${
                hasNote ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Nota para cocina"
            >
              <StickyNote className="w-3 h-3" />
              Nota
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-72 p-3 space-y-2">
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

        {/* Descuento */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={`flex items-center gap-1 text-[10px] px-1.5 h-5 rounded border transition ${
                hasDisc ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Descuento de línea"
            >
              <Percent className="w-3 h-3" />
              {hasDisc ? `${line.discountPct}%` : "Desc"}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56 p-3 space-y-2">
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
          onClick={onRemove}
          className="ml-auto text-muted-foreground hover:text-destructive p-0.5"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
