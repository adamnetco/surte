import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, CreditCard, Smartphone, ArrowLeftRight, Wallet, Download, Calendar } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type MethodKey = "efectivo" | "tarjeta_debito" | "tarjeta_credito" | "transferencia" | "nequi" | "daviplata" | "otro";

const METHOD_META: Record<MethodKey, { label: string; icon: React.ComponentType<{ className?: string }>; hue: string }> = {
  efectivo:         { label: "Efectivo",   icon: Banknote,       hue: "hsl(142 71% 45%)" },
  tarjeta_debito:   { label: "Débito",     icon: CreditCard,     hue: "hsl(217 91% 60%)" },
  tarjeta_credito:  { label: "Crédito",    icon: CreditCard,     hue: "hsl(262 83% 58%)" },
  transferencia:    { label: "Transfer.",  icon: ArrowLeftRight, hue: "hsl(24 95% 53%)"  },
  nequi:            { label: "Nequi",      icon: Smartphone,     hue: "hsl(320 85% 52%)" },
  daviplata:        { label: "Daviplata",  icon: Smartphone,     hue: "hsl(0 84% 60%)"   },
  otro:             { label: "Otro",       icon: Wallet,         hue: "hsl(215 16% 47%)" },
};

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "prev_month";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "prev_month", label: "Mes anterior" },
];

function rangeFor(key: PresetKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "today") return { from: start, to: now, label: "Hoy" };
  if (key === "yesterday") {
    const y = new Date(start); y.setDate(y.getDate() - 1);
    const end = new Date(start); end.setSeconds(-1);
    return { from: y, to: end, label: "Ayer" };
  }
  if (key === "7d") {
    const f = new Date(start); f.setDate(f.getDate() - 6);
    return { from: f, to: now, label: "Últimos 7 días" };
  }
  if (key === "30d") {
    const f = new Date(start); f.setDate(f.getDate() - 29);
    return { from: f, to: now, label: "Últimos 30 días" };
  }
  // prev_month
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { from: first, to: last, label: "Mes anterior" };
}

const COP = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

interface Row { method: MethodKey; amount: number; count: number }

/**
 * Reporte de métodos de pago (pos_payments) — presets por rango de fecha.
 * Muestra breakdown por método con barra proporcional y CSV export.
 */
export default function PaymentMethodsReportSheet({ open, onOpenChange }: Props) {
  const { currentOrg: organization } = useOrganization();
  const [preset, setPreset] = useState<PresetKey>("today");
  const range = useMemo(() => rangeFor(preset), [preset]);

  const { data, isLoading } = useQuery({
    queryKey: ["payment-methods-report", organization?.id, preset],
    enabled: open && !!organization?.id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("pos_payments")
        .select("method, amount, created_at")
        .eq("organization_id", organization!.id)
        .gte("created_at", range.from.toISOString())
        .lte("created_at", range.to.toISOString());
      if (error) throw error;
      const agg = new Map<MethodKey, Row>();
      for (const r of rows ?? []) {
        const key = (r.method as MethodKey) in METHOD_META ? (r.method as MethodKey) : "otro";
        const cur = agg.get(key) ?? { method: key, amount: 0, count: 0 };
        cur.amount += Number(r.amount) || 0;
        cur.count += 1;
        agg.set(key, cur);
      }
      const out = Array.from(agg.values()).sort((a, b) => b.amount - a.amount);
      const total = out.reduce((s, r) => s + r.amount, 0);
      const totalCount = out.reduce((s, r) => s + r.count, 0);
      return { rows: out, total, totalCount };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalCount = data?.totalCount ?? 0;

  const exportCsv = () => {
    const header = ["Método", "Cantidad", "Monto (COP)", "% del total"].join(",");
    const lines = rows.map((r) => {
      const pct = total > 0 ? ((r.amount / total) * 100).toFixed(1) : "0";
      return [METHOD_META[r.method].label, r.count, Math.round(r.amount), pct].join(",");
    });
    const csv = [header, ...lines, "", ["Total", totalCount, Math.round(total), "100"].join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metodos-pago-${preset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Métodos de pago recibidos
          </SheetTitle>
          <SheetDescription>
            Cobros registrados en el POS agrupados por forma de pago. Excluye e-commerce.
          </SheetDescription>
        </SheetHeader>

        {/* Presets */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-semibold transition ${
                preset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-accent/20 border-border text-foreground"
              }`}
            >
              {p.key === "today" ? <Calendar className="w-3 h-3" /> : null}
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-2 text-[10px] text-muted-foreground font-mono">
          {range.from.toLocaleDateString("es-CO")} → {range.to.toLocaleDateString("es-CO")}
        </div>

        {/* Total */}
        <div className="mt-4 rounded-lg border bg-primary/5 border-primary/20 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total recaudado</div>
          <div className="font-seg7 text-primary text-3xl tabular-nums leading-none mt-1">{COP(total)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{totalCount} {totalCount === 1 ? "cobro" : "cobros"}</div>
        </div>

        {/* Breakdown */}
        <div className="mt-4 space-y-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          {!isLoading && rows.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Sin cobros en este rango.
            </div>
          )}
          {!isLoading && rows.map((r) => {
            const meta = METHOD_META[r.method];
            const Icon = meta.icon;
            const pct = total > 0 ? (r.amount / total) * 100 : 0;
            return (
              <div key={r.method} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                      style={{ backgroundColor: `${meta.hue}22`, color: meta.hue }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{meta.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.count} {r.count === 1 ? "cobro" : "cobros"} · {pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="font-seg7 text-lg tabular-nums shrink-0" style={{ color: meta.hue }}>
                    {COP(r.amount)}
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: meta.hue }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Export */}
        {rows.length > 0 && (
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
