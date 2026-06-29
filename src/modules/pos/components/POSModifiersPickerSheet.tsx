import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ModifierPicker, { type SelectedModifier } from "@/modules/storefront/components/ModifierPicker";

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; price: number } | null;
  /**
   * Se invoca cuando el cajero confirma la selección.
   * adjustment es el delta de precio a sumar al unitPrice base.
   * summary es un texto plano `Sin cebolla · +Queso` para guardar en notes.
   */
  onConfirm: (adjustment: number, summary: string) => void;
}

/**
 * Sheet que se auto-abre al añadir un producto con modifier_groups en POS.
 * Bloquea confirmar hasta que `isValid` (grupos requeridos completos).
 */
export default function POSModifiersPickerSheet({ open, onOpenChange, product, onConfirm }: Props) {
  const [mods, setMods] = useState<SelectedModifier[]>([]);
  const [adjustment, setAdjustment] = useState(0);
  const [valid, setValid] = useState(false);

  if (!product) return null;

  const handleConfirm = () => {
    if (!valid) return;
    const summary = mods
      .map((m) => (m.quantity > 1 ? `${m.quantity}× ${m.displayName}` : m.displayName))
      .join(" · ");
    onConfirm(adjustment, summary);
    setMods([]);
    setAdjustment(0);
    setValid(false);
  };

  const total = product.price + adjustment;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-base">Personalizar — {product.name}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ModifierPicker
            productId={product.id}
            onModifiersChange={(m, adj, isValid) => {
              setMods(m);
              setAdjustment(adj);
              setValid(isValid);
            }}
          />
        </div>

        <div className="border-t p-3 space-y-2 bg-card">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Base</span>
            <span>{COP(product.price)}</span>
          </div>
          {adjustment !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Modificadores</span>
              <span className={adjustment > 0 ? "text-accent" : "text-secondary"}>
                {adjustment > 0 ? "+" : ""}{COP(adjustment)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span>{COP(total)}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={!valid} onClick={handleConfirm}>
              Añadir al ticket
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
