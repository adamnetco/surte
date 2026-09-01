import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileSignature, AlertTriangle, CheckCircle2, Settings } from "lucide-react";
import type { ResolutionSnapshot } from "@/modules/pos/hooks/useEinvoiceResolutionStatus";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshot: ResolutionSnapshot;
  /** Navega a Facturación → Configuración. */
  onOpenConfig?: () => void;
}

const LABELS: Record<ResolutionSnapshot["status"], string> = {
  ok: "Resolución vigente",
  near_limit: "Resolución próxima a agotarse",
  exhausted: "Resolución agotada",
  missing: "Falta configurar la resolución",
  inactive: "Emisión electrónica desactivada",
  unknown: "Sin información de resolución",
};

/**
 * ResolutionsInfoDialog — vista de solo lectura del estado de la resolución DIAN
 * (equivalente al acceso "Resoluciones" del footer de eleventa/SysboPOS).
 * Presentación pura: recibe el snapshot y un callback de navegación.
 */
export default function ResolutionsInfoDialog({ open, onOpenChange, snapshot, onOpenConfig }: Props) {
  const { status, remaining, total, resolutionNumber, prefix } = snapshot;
  const used = total != null && remaining != null ? total - remaining : null;
  const pct = total && used != null ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const bad = status === "exhausted" || status === "missing";
  const warn = status === "near_limit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSignature className="w-4 h-4 text-primary" aria-hidden />
            Resoluciones DIAN
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={`rounded-lg border p-3 flex items-start gap-2 text-sm ${
              bad
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : warn
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-border bg-muted/30"
            }`}
          >
            {bad || warn ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-primary" aria-hidden />
            )}
            <span className="font-semibold">{LABELS[status]}</span>
          </div>

          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Número</dt>
              <dd className="font-semibold">{resolutionNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Prefijo</dt>
              <dd className="font-semibold">{prefix ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Consecutivos disponibles</dt>
              <dd className="font-semibold tabular-nums">{remaining ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Rango total</dt>
              <dd className="font-semibold tabular-nums">{total ?? "—"}</dd>
            </div>
          </dl>

          {total != null && (
            <div className="space-y-1">
              <Progress value={pct} aria-label={`Consumo de la resolución: ${pct}%`} />
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {used ?? 0} de {total} consecutivos usados ({pct}%)
              </p>
            </div>
          )}

          {onOpenConfig && (
            <Button variant="outline" className="w-full justify-start" onClick={onOpenConfig}>
              <Settings className="w-4 h-4 mr-2" aria-hidden /> Abrir configuración de facturación
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
