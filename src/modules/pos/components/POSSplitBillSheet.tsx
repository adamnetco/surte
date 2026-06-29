import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SplitSquareHorizontal, Users, ArrowRight } from "lucide-react";

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export interface SplitItem {
  id: string;
  product_name: string;
  quantity: number;
  total: number;
  status: string;
}
export interface SplitDestOrder {
  id: string;
  sub_label: string | null;
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableLabel: string;
  sourceOrderId: string;
  items: SplitItem[];
  /** Otras sub-cuentas existentes (excluye la actual) */
  otherOrders: SplitDestOrder[];
  /** Total de la cuenta actual (para modo equitativo) */
  total: number;
  onDone: () => void;
}

/**
 * Dividir cuenta: mover N items seleccionados a nueva o existente sub-cuenta,
 * o calcular partes iguales (informativo, no parte items físicamente).
 */
export default function POSSplitBillSheet({
  open, onOpenChange, tableLabel, sourceOrderId, items, otherOrders, total, onDone,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [parts, setParts] = useState(2);
  const [busy, setBusy] = useState(false);

  const eligible = useMemo(() => items.filter(i => i.status === "pending"), [items]);
  const selectedTotal = useMemo(
    () => eligible.filter(i => selected.has(i.id)).reduce((s, i) => s + Number(i.total), 0),
    [eligible, selected],
  );

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const moveSelected = async (destOrderId: string | null) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return toast.info("Selecciona al menos un item");
    setBusy(true);
    try {
      let target = destOrderId;
      if (!target) {
        const { data, error } = await (supabase.rpc as any)("split_table_order", { _source: sourceOrderId });
        if (error) throw error;
        target = data as string;
      }
      for (const itemId of ids) {
        const { error } = await (supabase.rpc as any)("transfer_table_item", { _item: itemId, _dest_order: target });
        if (error) throw error;
      }
      toast.success(`${ids.length} item(s) movido(s)`);
      setSelected(new Set());
      onDone();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al dividir");
    } finally {
      setBusy(false);
    }
  };

  const perPerson = parts > 0 ? total / parts : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <SplitSquareHorizontal className="w-4 h-4" />
            Dividir Mesa {tableLabel}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 grid grid-cols-2">
            <TabsTrigger value="items">Por items</TabsTrigger>
            <TabsTrigger value="equal">Partes iguales</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="flex-1 flex flex-col min-h-0 mt-0 px-4 pb-4">
            <p className="text-xs text-muted-foreground mt-3">
              Marca los items y muévelos a una nueva sub-cuenta o existente. Solo items <b>pendientes</b>.
            </p>
            <div className="flex-1 overflow-y-auto mt-3 space-y-1.5">
              {eligible.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No hay items pendientes para mover.
                </p>
              ) : eligible.map(it => {
                const checked = selected.has(it.id);
                return (
                  <label
                    key={it.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                      checked ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(it.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">x{it.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold">{COP(it.total)}</span>
                  </label>
                );
              })}
            </div>

            {eligible.length > 0 && (
              <div className="border-t pt-3 mt-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seleccionado</span>
                  <span className="font-bold">{COP(selectedTotal)}</span>
                </div>
                <Button
                  className="w-full"
                  disabled={busy || selected.size === 0}
                  onClick={() => moveSelected(null)}
                >
                  <SplitSquareHorizontal className="w-4 h-4 mr-1" />
                  Mover a nueva sub-cuenta
                </Button>
                {otherOrders.map(o => (
                  <Button
                    key={o.id}
                    variant="outline"
                    className="w-full justify-between"
                    disabled={busy || selected.size === 0}
                    onClick={() => moveSelected(o.id)}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Mover a {tableLabel}{o.sub_label ?? ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{COP(o.total)}</span>
                  </Button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="equal" className="flex-1 mt-0 px-4 pb-4">
            <p className="text-xs text-muted-foreground mt-3">
              Calcula cuánto paga cada comensal. <b>No</b> divide items físicamente; útil para mostrar al cliente al cobrar.
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={parts}
                  onChange={(e) => setParts(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="h-11 text-lg font-bold"
                />
                <span className="text-sm text-muted-foreground">personas</span>
              </div>

              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total cuenta</span>
                  <span className="font-medium">{COP(total)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-sm text-muted-foreground">Cada uno paga</span>
                  <span className="text-2xl font-bold text-primary">{COP(perPerson)}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Tip: el cajero puede registrar varios pagos parciales en el diálogo de cobro.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
