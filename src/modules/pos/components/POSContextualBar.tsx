import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tag, User2, PauseCircle, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface PriceList {
  id: string;
  name: string;
}

interface Props {
  organizationId: string;
  cashierName: string;
  priceListId: string | null;
  onPriceListChange: (id: string | null, name: string) => void;
  parkedCount?: number;
  onOpenParked?: () => void;
}

/**
 * Barra contextual inspirada en SoftwarePOS:
 * permite ver/elegir Lista de precios, ver vendedor activo
 * y abrir suspendidas — todo a 1 click, sin menús anidados.
 */
export default function POSContextualBar({
  organizationId,
  cashierName,
  priceListId,
  onPriceListChange,
  parkedCount = 0,
  onOpenParked,
}: Props) {
  const [lists, setLists] = useState<PriceList[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("price_lists")
        .select("id,name,is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name");
      if (!cancel && data) setLists(data as PriceList[]);
    })();
    return () => {
      cancel = true;
    };
  }, [organizationId]);

  const currentName =
    lists.find((l) => l.id === priceListId)?.name ?? "Pública";

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 text-xs"
      aria-label="Barra contextual de venta"
    >
      {/* Lista de precios */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-card",
            "hover:bg-accent/10 hover:border-accent/40 transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          title="Lista de precios aplicada al ticket"
        >
          <Tag className="w-3.5 h-3.5 text-accent" />
          <span className="font-semibold">Precios:</span>
          <span className="text-foreground/90 truncate max-w-[140px]">{currentName}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Listas disponibles</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onPriceListChange(null, "Pública")}>
            Pública (predeterminada)
          </DropdownMenuItem>
          {lists.map((l) => (
            <DropdownMenuItem
              key={l.id}
              onSelect={() => onPriceListChange(l.id, l.name)}
            >
              {l.name}
            </DropdownMenuItem>
          ))}
          {lists.length === 0 && (
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              No hay listas activas.
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Vendedor */}
      <div
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-card"
        title="Vendedor del turno"
      >
        <User2 className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold">Vendedor:</span>
        <span className="text-foreground/90 truncate max-w-[140px]">{cashierName}</span>
      </div>

      <div className="flex-1" />

      {/* Suspendidas */}
      <button
        type="button"
        onClick={onOpenParked}
        disabled={!onOpenParked}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-card",
          "hover:bg-amber-50 hover:border-amber-300 transition",
          "disabled:opacity-60 disabled:cursor-default"
        )}
        title="Tickets suspendidos"
      >
        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-semibold">Suspendidas</span>
        <span
          className={cn(
            "ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold",
            parkedCount > 0
              ? "bg-amber-500 text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          {parkedCount}
        </span>
      </button>
    </div>
  );
}
