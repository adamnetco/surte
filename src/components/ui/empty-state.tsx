import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
}

/**
 * Empty state reutilizable — sigue Daily Driver UX AC8.
 * Toda lista vacía debe usar este componente con ilustración + 1 CTA.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted/60 grid place-items-center mb-4",
          compact ? "w-12 h-12" : "w-16 h-16",
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground",
            compact ? "w-6 h-6" : "w-8 h-8",
          )}
          strokeWidth={1.5}
        />
      </div>
      <h3 className={cn("font-semibold text-foreground", compact ? "text-base" : "text-lg")}>
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          {action && (
            <Button onClick={action.onClick} variant="cta">
              {action.icon && <action.icon className="w-4 h-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
