import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FileDown, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Register { id: string; name: string }

interface BookRow {
  session_id: string;
  register_id: string;
  register_name: string;
  location_name: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_amount: number;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_transfer: number;
  total_other: number;
  ticket_count: number;
  expected_amount: number;
  closing_amount: number | null;
  difference: number | null;
  fiscal_seal_seq: number | null;
  fiscal_seal_hash: string | null;
  notes: string | null;
}

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    .format(Number(n ?? 0));

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function FiscalCashBookPanel() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [registerId, setRegisterId] = useState<string>("");

  const { data: registers } = useQuery({
    queryKey: ["cashbook-registers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("id,name")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Register[];
    },
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["cashbook", orgId, from, to, registerId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("cash_book_auxiliary", {
        _org_id: orgId,
        _from: from,
        _to: to,
        _register_id: registerId || null,
      });
      if (error) throw error;
      return (data ?? []) as BookRow[];
    },
  });

  const totals = useMemo(() => {
    const rows = data ?? [];
    return rows.reduce(
      (acc, r) => {
        acc.sales += Number(r.total_sales) || 0;
        acc.cash += Number(r.total_cash) || 0;
        acc.card += Number(r.total_card) || 0;
        acc.transfer += Number(r.total_transfer) || 0;
        acc.other += Number(r.total_other) || 0;
        acc.diff += Number(r.difference) || 0;
        acc.tickets += Number(r.ticket_count) || 0;
        return acc;
      },
      { sales: 0, cash: 0, card: 0, transfer: 0, other: 0, diff: 0, tickets: 0 }
    );
  }, [data]);

  const exportCsv = (delimiter: "," | ";" | "\t" = ",") => {
    const rows = data ?? [];
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = [
      "fecha_apertura", "fecha_cierre", "caja", "sucursal", "estado",
      "apertura", "ventas", "efectivo", "tarjeta", "transferencia", "otros",
      "tickets", "esperado", "contado", "diferencia",
      "sello_seq", "sello_hash", "notas",
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(delimiter) || s.includes("\n") || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(delimiter)];
    rows.forEach((r) => {
      lines.push([
        r.opened_at, r.closed_at ?? "", r.register_name, r.location_name, r.status,
        r.opening_amount, r.total_sales, r.total_cash, r.total_card, r.total_transfer, r.total_other,
        r.ticket_count, r.expected_amount, r.closing_amount ?? "", r.difference ?? "",
        r.fiscal_seal_seq ?? "", r.fiscal_seal_hash ?? "", (r.notes ?? "").replace(/\n/g, " "),
      ].map(escape).join(delimiter));
    });
    const ext = delimiter === "\t" ? "txt" : "csv";
    const mime = delimiter === "\t" ? "text/plain" : "text/csv";
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `libro-auxiliar-caja_${from}_${to}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportado · ${rows.length} sesiones`);
  };

  if (!currentOrg) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
        Selecciona una tienda en el menú lateral para consultar su libro auxiliar de caja.
      </div>
    );
  }

  const rows = data ?? [];
  const sealedCount = rows.filter((r) => r.fiscal_seal_hash).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Libro auxiliar de caja — {currentOrg.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Histórico de turnos cerrados con sello fiscal. Exportable a formato DIAN.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(",")}>
            <FileDown className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv(";")}>
            <FileDown className="w-4 h-4 mr-1" /> CSV (;)
          </Button>
          <Button size="sm" onClick={() => exportCsv("\t")}>
            <FileDown className="w-4 h-4 mr-1" /> TXT DIAN
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <div className="grid sm:grid-cols-4 gap-3 border border-border rounded-lg p-4 bg-card">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <input
            type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full border border-border rounded-md p-2 bg-background text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <input
            type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full border border-border rounded-md p-2 bg-background text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Caja</label>
          <select
            value={registerId}
            onChange={(e) => setRegisterId(e.target.value)}
            className="w-full border border-border rounded-md p-2 bg-background text-sm mt-1"
          >
            <option value="">— Todas —</option>
            {(registers ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => { refetch(); toast.message("Actualizando libro…"); }}
            disabled={isFetching}
            className="w-full"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-4 gap-3">
        <KpiCard label="Sesiones" value={String(rows.length)} hint={`${sealedCount} con sello`} />
        <KpiCard label="Ventas totales" value={fmt(totals.sales)} hint={`${totals.tickets} tickets`} />
        <KpiCard label="Efectivo / Otros" value={fmt(totals.cash)} hint={`Otros: ${fmt(totals.card + totals.transfer + totals.other)}`} />
        <KpiCard
          label="Diferencia acumulada"
          value={fmt(totals.diff)}
          hint={totals.diff === 0 ? "Cuadrado ✓" : totals.diff > 0 ? "Sobrante" : "Faltante"}
          tone={totals.diff === 0 ? "ok" : Math.abs(totals.diff) > 5000 ? "warn" : "neutral"}
        />
      </div>

      {/* Tabla */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No hay turnos en el rango seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Apertura</th>
                  <th className="text-left p-2">Caja</th>
                  <th className="text-right p-2">Ventas</th>
                  <th className="text-right p-2">Efectivo</th>
                  <th className="text-right p-2">Tickets</th>
                  <th className="text-right p-2">Esperado</th>
                  <th className="text-right p-2">Contado</th>
                  <th className="text-right p-2">Dif.</th>
                  <th className="text-left p-2">Sello</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = Number(r.difference ?? 0);
                  return (
                    <tr key={r.session_id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-2 whitespace-nowrap">
                        {new Date(r.opened_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{r.register_name}</div>
                        <div className="text-[10px] text-muted-foreground">{r.location_name}</div>
                      </td>
                      <td className="p-2 text-right">{fmt(r.total_sales)}</td>
                      <td className="p-2 text-right">{fmt(r.total_cash)}</td>
                      <td className="p-2 text-right">{r.ticket_count}</td>
                      <td className="p-2 text-right">{fmt(r.expected_amount)}</td>
                      <td className="p-2 text-right">{fmt(r.closing_amount)}</td>
                      <td className={`p-2 text-right font-medium ${d === 0 ? "" : d > 0 ? "text-success" : "text-destructive"}`}>
                        {fmt(d)}
                      </td>
                      <td className="p-2">
                        {r.fiscal_seal_hash ? (
                          <Badge variant="outline" className="border-success/40 text-success gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            #{r.fiscal_seal_seq} · {r.fiscal_seal_hash.slice(0, 8)}…
                          </Badge>
                        ) : r.status === "closed" ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="w-3 h-3" /> Sin sello
                          </Badge>
                        ) : (
                          <Badge variant="outline">Abierto</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, tone = "neutral" }: {
  label: string; value: string; hint?: string; tone?: "ok" | "warn" | "neutral";
}) {
  const toneCls = tone === "ok"
    ? "border-success/30 bg-success/5"
    : tone === "warn"
      ? "border-destructive/30 bg-destructive/5"
      : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
