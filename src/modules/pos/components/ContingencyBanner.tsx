import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  health: "online" | "degraded" | "offline" | "unknown";
  hasContingencyRange: boolean;
  className?: string;
}

/**
 * Banner persistente sobre el POS cuando DIAN está caído.
 * AC11 de POS-innapsis-emision-pos.
 *
 * - offline + rango configurado: muestra modo contingencia activo (verde-ámbar).
 * - offline + sin rango: rojo, bloquea visualmente y advierte al cajero.
 * - degraded: ámbar suave.
 * - online: no renderiza.
 */
export default function ContingencyBanner({ health, hasContingencyRange, className }: Props) {
  if (health === "online" || health === "unknown") return null;

  if (health === "degraded") {
    return (
      <div className={cn(
        "w-full px-3 py-1.5 text-xs flex items-center gap-2 bg-amber-50 text-amber-900 border-b border-amber-200",
        className,
      )}>
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>DIAN respondiendo lento — las emisiones pueden tardar más de lo habitual.</span>
      </div>
    );
  }

  // offline
  if (hasContingencyRange) {
    return (
      <div className={cn(
        "w-full px-3 py-2 text-xs flex items-center gap-2 bg-amber-100 text-amber-900 border-b border-amber-300 font-medium",
        className,
      )}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <b>Modo contingencia DIAN activo.</b> Cada venta se emite con consecutivo de contingencia
          y se transmitirá automáticamente cuando DIAN vuelva. Puedes seguir cobrando normal.
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full px-3 py-2 text-xs flex items-center gap-2 bg-destructive/10 text-destructive border-b border-destructive/30 font-medium",
      className,
    )}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        <b>DIAN no disponible y sin rango de contingencia.</b>{" "}
        Las nuevas ventas quedarán sin documento DIAN hasta restaurar el servicio.
        Configura el rango en <i>Facturación → Configuración</i>.
      </span>
    </div>
  );
}
