import { NavLink } from "react-router-dom";
import { LayoutGrid, ShoppingCart, Utensils, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Switcher horizontal compacto para alternar entre las 4 vistas operativas
 * del POS sin volver al hub. Se reutiliza en POSTopBar, Mesas y KDS para
 * dar consistencia y reducir clics (problema detectado en la auditoría:
 * sólo Mesas↔KDS estaban enlazadas, /pos no enlazaba a ninguna).
 *
 * En pantallas táctiles de 10" todos los targets son ≥40px de alto.
 */
type Item = { to: string; label: string; Icon: typeof LayoutGrid; end?: boolean };
const items: Item[] = [
  { to: "/pos",         label: "Panel",  Icon: LayoutGrid,   end: true },
  { to: "/pos/vender",  label: "Vender", Icon: ShoppingCart },
  { to: "/mesas",       label: "Mesas",  Icon: Utensils },
  { to: "/kds",         label: "KDS",    Icon: ChefHat },
];

export default function POSWorkspaceNav({
  className,
  variant = "light",
}: {
  className?: string;
  /** En KDS el header es claro pero el resto es oscuro; permite invertir contraste. */
  variant?: "light" | "dark";
}) {
  return (
    <nav
      aria-label="Navegación POS"
      className={cn(
        "flex items-center gap-1 rounded-full p-0.5",
        variant === "light" ? "bg-muted/60 border" : "bg-background/10 border border-background/20",
        className,
      )}
    >
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : variant === "light"
                ? "text-muted-foreground hover:bg-background hover:text-foreground"
                : "text-background/70 hover:bg-background/15 hover:text-background",
            )
          }
        >
          <Icon className="w-4 h-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
