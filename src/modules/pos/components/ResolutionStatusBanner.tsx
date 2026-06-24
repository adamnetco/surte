import { AlertTriangle, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolutionSnapshot } from "@/modules/pos/hooks/useEinvoiceResolutionStatus";

interface Props {
  snapshot: ResolutionSnapshot;
  einvoiceEnabled: boolean;
  className?: string;
}

/**
 * AC14: Banner pre-cobro cuando la resolución DIAN está ausente, agotada o por vencer.
 * Solo renderiza si la org tiene Facturación Electrónica activa (einvoiceEnabled).
 */
export default function ResolutionStatusBanner({ snapshot, einvoiceEnabled, className }: Props) {
  if (!einvoiceEnabled) return null;
  if (snapshot.status === "ok" || snapshot.status === "unknown") return null;

  if (snapshot.status === "near_limit") {
    return (
      <div className={cn(
        "w-full px-3 py-1.5 text-xs flex items-center gap-2 bg-amber-50 text-amber-900 border-b border-amber-200",
        className,
      )}>
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>
          Resolución <b>{snapshot.prefix ?? ""}{snapshot.resolutionNumber}</b> próxima a agotarse:
          quedan <b>{snapshot.remaining}</b> consecutivos. Solicita una nueva a la DIAN.
        </span>
      </div>
    );
  }

  if (snapshot.status === "exhausted") {
    return (
      <div className={cn(
        "w-full px-3 py-2 text-xs flex items-center gap-2 bg-destructive/10 text-destructive border-b border-destructive/30 font-medium",
        className,
      )}>
        <FileWarning className="w-4 h-4 shrink-0" />
        <span>
          <b>Resolución DIAN agotada.</b> Las próximas ventas no se podrán facturar electrónicamente.
          Configura una nueva resolución en <i>Facturación → Configuración</i>.
        </span>
      </div>
    );
  }

  if (snapshot.status === "inactive") {
    return (
      <div className={cn(
        "w-full px-3 py-1.5 text-xs flex items-center gap-2 bg-muted text-muted-foreground border-b",
        className,
      )}>
        <FileWarning className="w-3.5 h-3.5 shrink-0" />
        <span>Emisión electrónica desactivada. Las ventas se registran sin documento DIAN.</span>
      </div>
    );
  }

  // missing
  return (
    <div className={cn(
      "w-full px-3 py-2 text-xs flex items-center gap-2 bg-destructive/10 text-destructive border-b border-destructive/30 font-medium",
      className,
    )}>
      <FileWarning className="w-4 h-4 shrink-0" />
      <span>
        <b>Falta resolución DIAN.</b> Completa número, prefijo y rango en
        <i> Facturación → Configuración</i> antes de emitir factura electrónica.
      </span>
    </div>
  );
}
