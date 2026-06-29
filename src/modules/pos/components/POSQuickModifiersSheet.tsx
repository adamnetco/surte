/**
 * POSQuickModifiersSheet — Slice 2-food
 *
 * Al abrir una mesa por primera vez en un negocio `food`, mostramos un sheet
 * con modificadores "rápidos" frecuentes (Sin cebolla, Extra queso, Para
 * compartir, Sin sal, Para llevar, etc.) que se quedan "pegados" como nota al
 * próximo item añadido al ticket. Reduce 3-4 taps por línea a 1 tap.
 *
 * No reemplaza el ProductModifierDialog (el de modifier_groups con precio),
 * sólo añade una capa de notas frecuentes sin precio. Persiste último set por
 * organización en localStorage para que cada cocina arme su propio "pegote".
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Sparkles, X } from "lucide-react";

const DEFAULT_QUICK_MODS = [
  "Sin cebolla",
  "Sin sal",
  "Sin picante",
  "Extra queso",
  "Extra salsa",
  "Para compartir",
  "Para llevar",
  "Bien cocido",
  "Término medio",
] as const;

const lsKey = (orgId: string) => `pos:quick-mods:${orgId}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  tableLabel?: string | null;
  /** Aplica las notas seleccionadas como sticky para el próximo item añadido. */
  onApply: (notes: string[]) => void;
}

export default function POSQuickModifiersSheet({
  open,
  onOpenChange,
  organizationId,
  tableLabel,
  onApply,
}: Props) {
  const [chips, setChips] = useState<string[]>([...DEFAULT_QUICK_MODS]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newChip, setNewChip] = useState("");

  // Cargar chips persistidos por organización
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey(organizationId));
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) setChips(parsed);
      }
    } catch { /* noop */ }
  }, [organizationId]);

  // Reset selección al abrir
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const persist = (next: string[]) => {
    setChips(next);
    try {
      localStorage.setItem(lsKey(organizationId), JSON.stringify(next));
    } catch { /* noop */ }
  };

  const toggle = (chip: string) => {
    const next = new Set(selected);
    next.has(chip) ? next.delete(chip) : next.add(chip);
    setSelected(next);
  };

  const addChip = () => {
    const v = newChip.trim();
    if (!v || chips.includes(v)) { setNewChip(""); return; }
    persist([...chips, v]);
    setNewChip("");
  };

  const removeChip = (chip: string) => {
    persist(chips.filter((c) => c !== chip));
    const s = new Set(selected); s.delete(chip); setSelected(s);
  };

  const applyAndClose = () => {
    onApply(Array.from(selected));
    onOpenChange(false);
  };

  const skip = () => { onApply([]); onOpenChange(false); };

  const title = useMemo(
    () => tableLabel ? `Modificadores rápidos · Mesa ${tableLabel}` : "Modificadores rápidos",
    [tableLabel],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80dvh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> {title}
          </SheetTitle>
          <SheetDescription>
            Tap a las notas que se aplicarán al próximo ítem añadido al ticket.
            Puedes agregar/quitar chips a tu gusto — se guardan por negocio.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const on = selected.has(chip);
              return (
                <button
                  key={chip}
                  onClick={() => toggle(chip)}
                  className={`group inline-flex items-center gap-1.5 h-10 px-3 rounded-full border text-sm font-medium transition active:scale-95 ${
                    on
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card hover:border-primary"
                  }`}
                >
                  {chip}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Eliminar ${chip}`}
                    onClick={(e) => { e.stopPropagation(); removeChip(chip); }}
                    className="opacity-0 group-hover:opacity-100 transition rounded-full p-0.5 hover:bg-foreground/10"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Input
              value={newChip}
              onChange={(e) => setNewChip(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChip(); } }}
              placeholder="Agregar modificador (ej. Sin azúcar)"
              className="h-10"
            />
            <Button type="button" variant="outline" onClick={addChip} className="h-10">
              <Plus className="w-4 h-4 mr-1" /> Agregar
            </Button>
          </div>

          {selected.size > 0 && (
            <div className="mt-4 p-3 rounded-md bg-accent/10 border border-accent/30">
              <p className="text-[11px] uppercase font-bold tracking-wide text-accent mb-1.5">
                Se aplicará al próximo ítem
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selected).map((c) => (
                  <Badge key={c} variant="secondary">{c}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={skip} className="flex-1">
            Omitir
          </Button>
          <Button type="button" onClick={applyAndClose} className="flex-1" disabled={selected.size === 0}>
            Aplicar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
