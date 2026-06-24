import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDianHealth, type DianHealth } from "../hooks/useDianHealth";

interface Props {
  organizationId: string | null | undefined;
  className?: string;
  compact?: boolean;
}

const META: Record<DianHealth, { dot: string; text: string; label: string }> = {
  online: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    label: "DIAN online",
  },
  degraded: {
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-700",
    label: "DIAN lento",
  },
  offline: {
    dot: "bg-rose-500 animate-pulse",
    text: "text-rose-700",
    label: "DIAN offline — contingencia",
  },
  unknown: {
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    label: "DIAN ·",
  },
};

/**
 * Semáforo de salud DIAN para el topbar del POS.
 * AC10 de POS-innapsis-emision-pos.
 */
export default function DianHealthIndicator({ organizationId, className, compact }: Props) {
  const health = useDianHealth(organizationId);
  const meta = META[health];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background/50 text-xs",
        meta.text,
        className,
      )}
      title={meta.label}
      aria-label={meta.label}
    >
      <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
      {!compact && (
        <>
          <Activity className="w-3 h-3 opacity-70" />
          <span className="font-medium">{meta.label}</span>
        </>
      )}
    </div>
  );
}
