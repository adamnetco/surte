import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, RefreshCw, FileDown, Lock, History, Package, Banknote } from "lucide-react";
import { toast } from "sonner";

interface LogRow {
  id: string;
  sequence: number;
  source_table: "stock_movements" | "cash_movements";
  source_id: string;
  action: string;
  actor_id: string | null;
  amount: number | null;
  quantity: number | null;
  reason: string | null;
  payload: Record<string, unknown>;
  prev_hash: string | null;
  current_hash: string;
  created_at: string;
}

interface VerifyRow { total: number; ok: number; first_break: number | null }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

const fmtNum = (n: number | null, d = 2) =>
  n == null ? "—" : Number(n).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function FiscalAdjustmentsPanel() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";
  const [filter, setFilter] = useState<"all" | "stock" | "cash">("all");

  const { data: rows, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["fiscal-adj-log", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_adjustment_log")
        .select("*")
        .eq("organization_id", orgId)
        .order("sequence", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const { data: verify, refetch: reverify, isFetching: verifying } = useQuery({
    queryKey: ["fiscal-adj-verify", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("fiscal_adj_log_verify", { _org: orgId });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      return r as VerifyRow;
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "stock") return rows.filter((r) => r.source_table === "stock_movements");
    if (filter === "cash") return rows.filter((r) => r.source_table === "cash_movements");
    return rows;
  }, [rows, filter]);

  const integrityOk = verify && verify.total > 0 && verify.first_break == null;
  const noData = verify && verify.total === 0;

  const exportCsv = () => {
    if (!rows?.length) return;
    const header = ["sequence", "created_at", "source", "action", "actor", "qty", "amount", "reason", "hash"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([
        r.sequence,
        r.created_at,
        r.source_table,
        r.action,
        r.actor_id ?? "",
        r.quantity ?? "",
        r.amount ?? "",
        `"${(r.reason ?? "").replace(/"/g, '""')}"`,
        r.current_hash,
      ].join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-ajustes-${currentOrg?.slug ?? "org"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  if (!currentOrg) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
        Selecciona una tienda en el menú lateral para auditar su trail de ajustes.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Audit trail de ajustes
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Cada ajuste manual de inventario y caja queda registrado de forma
            inmutable, con hash SHA-256 encadenado. La cadena es verificable y
            cualquier alteración rompe la integridad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); reverify(); }} disabled={isFetching || verifying}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${(isFetching || verifying) ? "animate-spin" : ""}`} /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows?.length}>
            <FileDown className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
        </div>
      </header>

      {/* Integrity card */}
      {verify && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          noData
            ? "border-border bg-muted/30"
            : integrityOk
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-destructive/40 bg-destructive/10"
        }`}>
          {integrityOk ? (
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          ) : noData ? (
            <History className="w-6 h-6 text-muted-foreground" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-destructive" />
          )}
          <div className="flex-1">
            <div className="font-semibold text-sm">
              {noData
                ? "Sin registros aún"
                : integrityOk
                  ? "Cadena íntegra"
                  : `Integridad comprometida — primera ruptura en #${verify.first_break}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {verify.total} registro(s) · {verify.ok} verificado(s) correctamente.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterPill>
        <FilterPill active={filter === "stock"} onClick={() => setFilter("stock")}>
          <Package className="w-3 h-3 inline mr-1" /> Inventario
        </FilterPill>
        <FilterPill active={filter === "cash"} onClick={() => setFilter("cash")}>
          <Banknote className="w-3 h-3 inline mr-1" /> Caja
        </FilterPill>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !filtered.length ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No hay ajustes registrados para este filtro.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((r) => (
            <li key={r.id} className="p-3 grid grid-cols-[auto_1fr_auto] gap-3 items-start hover:bg-muted/40">
              <div className="text-center w-12">
                <div className="text-[10px] text-muted-foreground uppercase">#</div>
                <div className="font-mono text-sm font-semibold">{r.sequence}</div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={r.source_table === "stock_movements" ? "secondary" : "outline"} className="text-[10px]">
                    {r.source_table === "stock_movements" ? "Inventario" : "Caja"}
                  </Badge>
                  <span className="text-sm font-medium">{r.action}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(r.created_at)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  {r.quantity != null && <span>Cant: <strong className="text-foreground tabular-nums">{fmtNum(r.quantity, 2)}</strong></span>}
                  {r.amount != null && <span>Monto: <strong className="text-foreground tabular-nums">${fmtNum(r.amount, 0)}</strong></span>}
                  {r.reason && <span className="truncate max-w-md italic">"{r.reason}"</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono truncate" title={r.current_hash}>
                  hash {r.current_hash.slice(0, 16)}… ← {r.prev_hash ? r.prev_hash.slice(0, 12) + "…" : "genesis"}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                <Lock className="w-2.5 h-2.5 mr-1" /> inmutable
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}
