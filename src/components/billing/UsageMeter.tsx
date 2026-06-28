import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

export type UsageMeterProps = {
  label: string;
  used: number;
  limit: number | null; // null = unlimited
  pct: number;
  source?: "plan" | "override";
  unit?: string;
};

/**
 * Visual semáforo de uso vs límite. Reutilizable en /billing/overview, banners,
 * widgets de admin, etc.
 * Tiers: <70% verde, 70-89% amarillo, 90-99% naranja, 100%+ rojo.
 */
export function UsageMeter({ label, used, limit, pct, source = "plan", unit }: UsageMeterProps) {
  const unlimited = limit === null;
  const tier: "ok" | "warn" | "high" | "exceeded" =
    unlimited ? "ok" :
    pct >= 100 ? "exceeded" :
    pct >= 90 ? "high" :
    pct >= 70 ? "warn" : "ok";

  const tone = {
    ok: { bar: "[&>div]:bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
    warn: { bar: "[&>div]:bg-amber-500", text: "text-amber-600 dark:text-amber-400", Icon: AlertTriangle },
    high: { bar: "[&>div]:bg-orange-500", text: "text-orange-600 dark:text-orange-400", Icon: AlertTriangle },
    exceeded: { bar: "[&>div]:bg-destructive", text: "text-destructive", Icon: AlertCircle },
  }[tier];

  const fmt = (n: number) => n.toLocaleString("es-CO");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <tone.Icon className={`h-4 w-4 shrink-0 ${tone.text}`} aria-hidden />
          <span className="font-medium truncate">{label}</span>
          {source === "override" && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">custom</Badge>
          )}
        </div>
        <span className={`tabular-nums text-xs ${tone.text}`}>
          {fmt(used)}{unit ? ` ${unit}` : ""}
          {!unlimited && <> / {fmt(limit!)}{unit ? ` ${unit}` : ""}</>}
          {unlimited && <span className="text-muted-foreground"> · ilimitado</span>}
        </span>
      </div>
      <Progress value={unlimited ? 0 : pct} className={`h-2 ${tone.bar}`} aria-label={`${label} ${pct}%`} />
    </div>
  );
}
