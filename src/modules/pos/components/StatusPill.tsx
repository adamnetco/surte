import { memo } from "react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/modules/pos/hooks/useHealthSnapshot";

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: HealthStatus;
  /** Short hint shown next to the dot in the trigger title attribute. */
  hint: string;
  /** Long human description shown inside the popover. */
  description: string;
  /** Action link (e.g. /sitios). */
  actionHref?: string;
  actionLabel?: string;
  /** Retry handler (resets backoff). */
  onRetry?: () => void;
  /** Last events list to surface (logger excerpt). */
  events?: string[];
  /** Status transition timeline (most-recent first). */
  timeline?: string[];
}

const dotColor: Record<HealthStatus, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  off: "bg-rose-500",
  unknown: "bg-muted-foreground/40",
};

const statusText: Record<HealthStatus, string> = {
  ok: "operativo",
  warn: "con advertencias",
  off: "fuera de servicio",
  unknown: "desconocido",
};

/**
 * Accessible status pill: visible label + dot + icon, opens a popover with
 * a clear error message, retry action, and resolution link. Memoised so it
 * only re-renders when its props change.
 */
function StatusPillBase({
  icon: Icon,
  label,
  status,
  hint,
  description,
  actionHref,
  actionLabel,
  onRetry,
  events,
}: Props) {
  const triggerId = `pill-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={triggerId}
          type="button"
          aria-label={`${label}: ${statusText[status]}. ${hint}`}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px] leading-none transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <span
            aria-hidden
            className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor[status])}
          >
            {status === "ok" && (
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
            )}
          </span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="font-medium text-foreground hidden sm:inline">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 text-sm"
        role="dialog"
        aria-labelledby={triggerId}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", dotColor[status])} aria-hidden />
          <p className="font-semibold">{label}</p>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
            {statusText[status]}
          </span>
        </div>
        <p className="text-muted-foreground text-xs mb-3" aria-live="polite">{description}</p>
        {events && events.length > 0 && (
          <ul className="mb-3 space-y-1 max-h-24 overflow-y-auto rounded-md bg-muted/50 p-2 text-[10px]">
            {events.slice(0, 3).map((e, i) => (
              <li key={i} className="font-mono text-muted-foreground truncate" title={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="h-8 gap-1">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Reintentar
            </Button>
          )}
          {actionHref && (
            <Button size="sm" variant="default" asChild className="h-8">
              <Link to={actionHref}>{actionLabel ?? "Resolver"}</Link>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const StatusPill = memo(StatusPillBase);
