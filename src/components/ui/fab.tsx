import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  label?: string;
  position?: "bottom-right" | "bottom-center" | "bottom-left";
  extended?: boolean;
}

/**
 * Floating Action Button — sigue Daily Driver UX AC16.
 * Acción principal de cada pantalla en mobile.
 * Se oculta automáticamente en desktop (md:hidden) si no se sobrescribe className.
 */
export const Fab = React.forwardRef<HTMLButtonElement, FabProps>(
  (
    {
      icon: Icon = Plus,
      label,
      position = "bottom-right",
      extended = false,
      className,
      ...props
    },
    ref,
  ) => {
    const positionClass = {
      "bottom-right": "right-4 bottom-20",
      "bottom-center": "left-1/2 -translate-x-1/2 bottom-20",
      "bottom-left": "left-4 bottom-20",
    }[position];

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "fixed z-40 md:hidden",
          positionClass,
          "shadow-lg hover:shadow-xl active:scale-95 transition-all",
          "bg-primary text-primary-foreground rounded-full",
          extended ? "px-5 h-14 gap-2 flex items-center" : "w-14 h-14 grid place-items-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        aria-label={label ?? "Acción principal"}
        {...props}
      >
        <Icon className={extended ? "w-5 h-5" : "w-6 h-6"} strokeWidth={2.25} />
        {extended && label && <span className="font-semibold text-sm">{label}</span>}
      </button>
    );
  },
);
Fab.displayName = "Fab";
