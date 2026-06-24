import { CheckCircle2, Loader2, AlertTriangle, Clock, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EinvoiceLiveSnapshot } from "../hooks/useEinvoiceLiveStatus";

interface Props {
  snap: EinvoiceLiveSnapshot;
  className?: string;
}

/**
 * Badge en vivo del estado DIAN tras cobrar.
 * AC4 de POS-innapsis-emision-pos.
 */
export default function EinvoiceStatusBadge({ snap, className }: Props) {
  if (snap.status === "idle") return null;

  const cfg = (() => {
    switch (snap.status) {
      case "queued":
        return {
          tone: "bg-sky-50 text-sky-700 border-sky-200",
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          label: "Encolando DIAN…",
        };
      case "sending":
        return {
          tone: "bg-sky-50 text-sky-700 border-sky-200",
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          label: "Enviando a DIAN…",
        };
      case "accepted":
        return {
          tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: snap.cufe ? `Aceptado · CUFE ${snap.cufe.slice(0, 8)}…` : "Aceptado por DIAN",
        };
      case "retrying":
        return {
          tone: "bg-amber-50 text-amber-700 border-amber-200",
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          label: `Reintentando${snap.retryAttempt ? ` (${snap.retryAttempt}/5)` : ""}`,
        };
      case "rejected":
        return {
          tone: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: snap.errorMessage ? `DIAN rechazó: ${snap.errorMessage.slice(0, 40)}` : "DIAN rechazó",
        };
      case "dead_letter":
        return {
          tone: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: "Error permanente — revisar",
        };
      case "timeout":
        return {
          tone: "bg-muted text-muted-foreground border-border",
          icon: <Clock className="w-3.5 h-3.5" />,
          label: "Procesando en background…",
        };
      default:
        return null;
    }
  })();

  if (!cfg) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium",
        cfg.tone,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {cfg.icon}
      <span className="truncate">{cfg.label}</span>
    </div>
  );
}
