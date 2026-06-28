import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Download, ExternalLink, AlertCircle, RefreshCcw, CreditCard, Gift,
} from "lucide-react";

const COP = (n: number, currency = "COP") =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(Number(n || 0));

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "2-digit" }) : "—";

type StatusKey = "paid" | "pending" | "failed" | "retrying" | "void" | string;

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid:     { label: "Pagada",      variant: "default" },
  pending:  { label: "Pendiente",   variant: "secondary" },
  retrying: { label: "Reintentando", variant: "secondary" },
  failed:   { label: "Fallida",     variant: "destructive" },
  void:     { label: "Anulada",     variant: "outline" },
};

type Invoice = {
  id: string;
  amount: number;
  currency: string;
  status: StatusKey;
  due_date: string;
  paid_at: string | null;
  period_start: string;
  period_end: string;
  pdf_url: string | null;
  checkout_url: string | null;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  wompi_reference: string | null;
  created_at: string;
  credit_applied_amount: number | null;
  credit_applied_at: string | null;
};

export default function BillingInvoices() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const { data, isLoading, refetch, isFetching } = useQuery({
    enabled: !!orgId,
    queryKey: ["billing-invoices", orgId],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select(
          "id, amount, currency, status, due_date, paid_at, period_start, period_end, pdf_url, checkout_url, attempt_count, max_attempts, last_error, wompi_reference, created_at"
        )
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data as Invoice[]) ?? [];
    },
  });

  const summary = useMemo(() => {
    const inv = data ?? [];
    const total = inv.reduce((a, b) => a + Number(b.amount || 0), 0);
    const paid = inv.filter(i => i.status === "paid").reduce((a, b) => a + Number(b.amount), 0);
    const pending = inv.filter(i => ["pending", "retrying", "failed"].includes(i.status))
      .reduce((a, b) => a + Number(b.amount), 0);
    return { total, paid, pending, count: inv.length };
  }, [data]);

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground">
            Historial de cobros recurrentes Wompi y descarga de comprobantes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/billing/overview">
              <CreditCard className="h-4 w-4 mr-1.5" /> Resumen
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total facturado</div>
          <div className="text-xl font-semibold mt-1">{COP(summary.total)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{summary.count} factura{summary.count === 1 ? "" : "s"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pagado</div>
          <div className="text-xl font-semibold mt-1 text-emerald-600">{COP(summary.paid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pendiente</div>
          <div className={`text-xl font-semibold mt-1 ${summary.pending > 0 ? "text-amber-600" : ""}`}>
            {COP(summary.pending)}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Aún no hay facturas emitidas para esta organización.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Wompi ref</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(inv => {
                  const meta = STATUS_META[inv.status] ?? { label: inv.status, variant: "outline" as const };
                  const isOpen = ["pending", "retrying", "failed"].includes(inv.status);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDate(inv.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right font-medium">{COP(inv.amount, inv.currency)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {inv.status === "failed" && inv.last_error && (
                            <span className="text-[10px] text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {inv.last_error.slice(0, 36)}…
                            </span>
                          )}
                          {inv.attempt_count > 0 && isOpen && (
                            <span className="text-[10px] text-muted-foreground">
                              Intento {inv.attempt_count}/{inv.max_attempts}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {inv.wompi_reference ? inv.wompi_reference.slice(0, 14) + "…" : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {inv.pdf_url && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                                <Download className="h-3.5 w-3.5 mr-1" /> PDF
                              </a>
                            </Button>
                          )}
                          {isOpen && inv.checkout_url && (
                            <Button size="sm" asChild>
                              <a href={inv.checkout_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Pagar
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Los comprobantes PDF se generan al confirmarse el pago en Wompi y quedan disponibles 12 meses.
      </p>
    </div>
  );
}
