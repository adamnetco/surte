import { Store, ChevronDown, Globe } from "lucide-react";
import { useLocation } from "@/modules/platform/context/LocationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Selector global de sucursal. Aparece en el TopBar admin.
 * - "Consolidado" = vista multi-sucursal (currentLocationId = "all").
 * - Una sucursal específica filtra todos los reportes y listas por location.
 */
export function LocationSwitcher({ compact = false }: { compact?: boolean }) {
  const { locations, currentLocationId, currentLocation, setCurrentLocationId, loading } = useLocation();

  if (loading) return null;
  if (locations.length <= 1) return null; // Solo mostrar cuando hay 2+ sucursales

  const label =
    currentLocationId === "all"
      ? "Consolidado"
      : currentLocation?.name ?? "Sucursal";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          {currentLocationId === "all" ? <Globe className="h-4 w-4" /> : <Store className="h-4 w-4" />}
          {!compact && <span className="font-medium truncate max-w-[140px]">{label}</span>}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover z-[100]">
        <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCurrentLocationId("all")} className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="flex-1">Consolidado (todas)</span>
          {currentLocationId === "all" && <Badge variant="secondary">Activa</Badge>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {locations.map((loc) => (
          <DropdownMenuItem
            key={loc.id}
            onClick={() => setCurrentLocationId(loc.id)}
            className="gap-2"
          >
            <Store className="h-4 w-4" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{loc.name}</div>
              {loc.city && <div className="text-xs text-muted-foreground truncate">{loc.city}</div>}
            </div>
            {loc.is_main && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
            {currentLocationId === loc.id && <Badge variant="secondary">Activa</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
