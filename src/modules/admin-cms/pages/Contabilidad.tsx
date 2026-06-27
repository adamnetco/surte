import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Layers, Calendar, RefreshCw, BarChart3, FileDown, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { exportSiigoCSV, exportAlegraCSV, printFinancialStatements, exportEInvoicesXLSX, exportVatSummaryXLSX, exportAccountLedgerXLSX, docSign, type EInvoiceRow, type VatRow, type LedgerRow } from "@/modules/admin-cms/lib/accountingExports";
import { FileText, Receipt, Search } from "lucide-react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs";
  nature: "debit" | "credit";
  is_active: boolean;
};

type JournalEntryRow = {
  id: string;
  entry_date: string;
  narration: string | null;
  reference_type: string | null;
  status: "draft" | "posted" | "voided";
  is_reversal: boolean;
  total: number;
};

const TYPE_LABEL: Record<Account["type"], { label: string; tone: string }> = {
  asset:     { label: "Activo",     tone: "bg-blue-50 text-blue-700 border-blue-200" },
  liability: { label: "Pasivo",     tone: "bg-amber-50 text-amber-700 border-amber-200" },
  equity:    { label: "Patrimonio", tone: "bg-purple-50 text-purple-700 border-purple-200" },
  revenue:   { label: "Ingreso",    tone: "bg-green-50 text-green-700 border-green-200" },
  cogs:      { label: "Costo",      tone: "bg-orange-50 text-orange-700 border-orange-200" },
  expense:   { label: "Gasto",      tone: "bg-red-50 text-red-700 border-red-200" },
};

export default function Contabilidad() {
  const { user, role, loading } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";
  const navigate = useNavigate();
  const [tab, setTab] = useState("accounts");
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

  const trialQ = useQuery({
    queryKey: ["trial_balance", orgId, from, to],
    enabled: !!orgId && tab === "reports",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_trial_balance" as any, {
        _org: orgId, _from: from, _to: to,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ code: string; name: string; type: string; debit_total: number; credit_total: number; balance: number }>;
    },
  });

  const plQ = useQuery({
    queryKey: ["pl", orgId, from, to],
    enabled: !!orgId && tab === "reports",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_income_statement" as any, {
        _org: orgId, _from: from, _to: to,
      });
      if (error) throw error;
      return data as { revenue: number; cogs: number; gross_profit: number; expenses: number; net_income: number };
    },
  });

  const bsQ = useQuery({
    queryKey: ["bs", orgId, to],
    enabled: !!orgId && tab === "reports",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_balance_sheet" as any, {
        _org: orgId, _as_of: to,
      });
      if (error) throw error;
      return data as { assets: number; liabilities: number; equity: number; net_income: number; balanced: boolean };
    },
  });

  useEffect(() => {
    if (!loading && !user) { toast.error("Acceso denegado"); navigate("/login"); }
    else if (!loading && !["superadmin", "admin"].includes(role)) {
      toast.error("Solo administradores"); navigate("/");
    }
  }, [user, role, loading, navigate]);

  const accountsQ = useQuery({
    queryKey: ["accounting_accounts", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounting_accounts" as any)
        .select("id, code, name, type, nature, is_active")
        .eq("organization_id", orgId)
        .order("code");
      if (error) throw error;
      return ((data ?? []) as unknown) as Account[];
    },
  });

  const entriesQ = useQuery({
    queryKey: ["journal_entries_recent", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<JournalEntryRow[]> => {
      const { data, error } = await supabase
        .from("journal_entries" as any)
        .select("id, entry_date, narration, reference_type, status, is_reversal, lines:journal_entry_lines(debit_amount)")
        .eq("organization_id", orgId)
        .order("entry_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        id: e.id,
        entry_date: e.entry_date,
        narration: e.narration,
        reference_type: e.reference_type,
        status: e.status,
        is_reversal: e.is_reversal,
        total: (e.lines ?? []).reduce((s: number, l: any) => s + Number(l.debit_amount || 0), 0),
      }));
    },
  });

  const periodsQ = useQuery({
    queryKey: ["fiscal_periods", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_periods" as any)
        .select("id, name, start_date, end_date, status")
        .eq("organization_id", orgId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading || !orgId) {
    return <div className="p-8 text-center text-muted-foreground">Cargando…</div>;
  }

  const accounts = accountsQ.data ?? [];
  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a); return acc;
  }, {});
  const order: Account["type"][] = ["asset", "liability", "equity", "revenue", "cogs", "expense"];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-heading font-bold text-primary">Contabilidad</h1>
          <p className="text-sm text-muted-foreground">
            Motor de doble entrada oculto al usuario. Las ventas, pagos y compras generan asientos automáticos.
          </p>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="accounts"><Layers className="w-4 h-4 mr-1" />Plan de cuentas</TabsTrigger>
            <TabsTrigger value="journal"><BookOpen className="w-4 h-4 mr-1" />Libro diario</TabsTrigger>
            <TabsTrigger value="reports"><BarChart3 className="w-4 h-4 mr-1" />Reportes</TabsTrigger>
            <TabsTrigger value="periods"><Calendar className="w-4 h-4 mr-1" />Períodos</TabsTrigger>
            <TabsTrigger value="accountant"><FileText className="w-4 h-4 mr-1" />Para contador</TabsTrigger>
          </TabsList>

          {/* Plan de cuentas */}
          <TabsContent value="accounts" className="space-y-3 mt-4">
            {accountsQ.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : accounts.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No hay cuentas. Se sembrarán automáticamente al crear la organización.
              </Card>
            ) : (
              order.map((t) => grouped[t]?.length ? (
                <Card key={t} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Badge variant="outline" className={TYPE_LABEL[t].tone}>{TYPE_LABEL[t].label}</Badge>
                      <span className="text-sm text-muted-foreground">({grouped[t].length})</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {grouped[t].map((a) => (
                      <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-muted/30">
                        <span className="font-mono text-xs text-muted-foreground w-12">{a.code}</span>
                        <span className="text-sm flex-1 truncate">{a.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {a.nature === "debit" ? "DR" : "CR"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null)
            )}
          </TabsContent>

          {/* Libro diario */}
          <TabsContent value="journal" className="space-y-3 mt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Últimos asientos (50)</h3>
                <button
                  onClick={() => entriesQ.refetch()}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />Refrescar
                </button>
              </div>
              {entriesQ.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (entriesQ.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sin asientos aún. Se generarán automáticamente cuando se registren ventas y pagos (Slice 2).
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesQ.data!.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.entry_date}</TableCell>
                        <TableCell className="text-sm">
                          {e.is_reversal && <Badge variant="outline" className="mr-1 text-[10px]">REV</Badge>}
                          {e.narration ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.reference_type ?? "manual"}</TableCell>
                        <TableCell className="text-right font-mono">${e.total.toLocaleString("es-CO")}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "posted" ? "default" : e.status === "voided" ? "destructive" : "secondary"} className="text-[10px]">
                            {e.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Reportes financieros */}
          <TabsContent value="reports" className="space-y-3 mt-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Desde</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Hasta / Corte</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { trialQ.refetch(); plQ.refetch(); bsQ.refetch(); }}>
                  <RefreshCw className="w-3 h-3 mr-1" />Recalcular
                </Button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    try { await exportSiigoCSV(orgId, from, to); toast.success("CSV Siigo descargado"); }
                    catch (e: any) { toast.error(e.message ?? "Error exportando"); }
                  }}>
                    <FileDown className="w-3 h-3 mr-1" />Siigo CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try { await exportAlegraCSV(orgId, from, to); toast.success("CSV Alegra descargado"); }
                    catch (e: any) { toast.error(e.message ?? "Error exportando"); }
                  }}>
                    <FileDown className="w-3 h-3 mr-1" />Alegra CSV
                  </Button>
                  <Button variant="default" size="sm" disabled={!plQ.data || !bsQ.data} onClick={() => {
                    if (!plQ.data || !bsQ.data) return;
                    printFinancialStatements({
                      orgName: currentOrg?.name ?? "Organización",
                      from, to,
                      pl: plQ.data,
                      bs: bsQ.data,
                      tb: (trialQ.data ?? []) as any,
                    });
                  }}>
                    <Printer className="w-3 h-3 mr-1" />PDF Estados
                  </Button>
                </div>
              </div>
            </Card>

            {/* P&L + Balance Sheet KPI cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />Estado de Resultados
                </h3>
                {plQ.isLoading || !plQ.data ? <Skeleton className="h-32 w-full" /> : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Ingresos</span><span className="font-mono text-green-700">{fmt(plQ.data.revenue)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>(−) Costo de ventas</span><span className="font-mono">{fmt(plQ.data.cogs)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-medium"><span>Utilidad bruta</span><span className="font-mono">{fmt(plQ.data.gross_profit)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>(−) Gastos</span><span className="font-mono">{fmt(plQ.data.expenses)}</span></div>
                    <div className={`flex justify-between border-t pt-2 font-bold ${plQ.data.net_income >= 0 ? "text-green-700" : "text-red-700"}`}>
                      <span>Utilidad neta</span><span className="font-mono">{fmt(plQ.data.net_income)}</span>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" />Balance General (al {to})
                </h3>
                {bsQ.isLoading || !bsQ.data ? <Skeleton className="h-32 w-full" /> : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Activos</span><span className="font-mono text-blue-700">{fmt(bsQ.data.assets)}</span></div>
                    <div className="flex justify-between"><span>Pasivos</span><span className="font-mono text-amber-700">{fmt(bsQ.data.liabilities)}</span></div>
                    <div className="flex justify-between"><span>Patrimonio</span><span className="font-mono text-purple-700">{fmt(bsQ.data.equity)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Utilidad del ejercicio</span><span className="font-mono">{fmt(bsQ.data.net_income)}</span></div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Ecuación contable</span>
                      <Badge variant={bsQ.data.balanced ? "default" : "destructive"}>
                        {bsQ.data.balanced ? "Cuadra ✓" : "Descuadrada"}
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Trial Balance */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Balance de Comprobación</h3>
              {trialQ.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (trialQ.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin movimientos en el rango seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Cuenta</TableHead>
                        <TableHead className="text-right">Débitos</TableHead>
                        <TableHead className="text-right">Créditos</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialQ.data!.filter((r) => Number(r.debit_total) + Number(r.credit_total) > 0).map((r) => (
                        <TableRow key={r.code}>
                          <TableCell className="font-mono text-xs">{r.code}</TableCell>
                          <TableCell className="text-sm">{r.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt(Number(r.debit_total))}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt(Number(r.credit_total))}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">{fmt(Number(r.balance))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Períodos */}
          <TabsContent value="periods" className="space-y-3 mt-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">Abrir nuevo período</h3>
              <PeriodOpener orgId={orgId} onDone={() => periodsQ.refetch()} />
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Períodos fiscales</h3>
                <YearCloseButton orgId={orgId} onDone={() => { periodsQ.refetch(); entriesQ.refetch(); }} />
              </div>
              {periodsQ.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (periodsQ.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Aún no se han abierto períodos. Crea el primero arriba.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Hasta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodsQ.data!.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.start_date}</TableCell>
                        <TableCell className="font-mono text-xs">{p.end_date}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "open" ? "default" : "secondary"}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <PeriodActions period={p} role={role} onDone={() => periodsQ.refetch()} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Reportes para el contador (DIAN / IVA / Libro auxiliar) */}
          <TabsContent value="accountant" className="space-y-3 mt-4">
            <AccountantReports
              orgId={orgId}
              orgName={currentOrg?.name ?? "Organización"}
              from={from}
              to={to}
              setFrom={setFrom}
              setTo={setTo}
              accounts={accounts}
              fmt={fmt}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============ Period subcomponents ============
function PeriodOpener({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const [name, setName] = useState(`${y}-${String(m).padStart(2, "0")}`);
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (!name.trim()) return toast.error("Falta el nombre del período");
    setLoading(true);
    const { error } = await supabase.rpc("open_fiscal_period" as any, { _org: orgId, _name: name, _start: s, _end: e });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Período abierto");
    onDone();
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><label className="text-xs text-muted-foreground block mb-1">Nombre</label><Input value={name} onChange={(ev) => setName(ev.target.value)} className="w-32" /></div>
      <div><label className="text-xs text-muted-foreground block mb-1">Desde</label><Input type="date" value={s} onChange={(ev) => setS(ev.target.value)} className="w-40" /></div>
      <div><label className="text-xs text-muted-foreground block mb-1">Hasta</label><Input type="date" value={e} onChange={(ev) => setE(ev.target.value)} className="w-40" /></div>
      <Button size="sm" onClick={open} disabled={loading}>Abrir período</Button>
    </div>
  );
}

function PeriodActions({ period, role, onDone }: { period: any; role: string; onDone: () => void }) {
  const close = async () => {
    if (!window.confirm(`Cerrar el período ${period.name}? Ya no se podrán registrar asientos en sus fechas.`)) return;
    const { error } = await supabase.rpc("close_fiscal_period" as any, { _id: period.id });
    if (error) return toast.error(error.message);
    toast.success("Período cerrado");
    onDone();
  };
  const reopen = async () => {
    const { error } = await supabase.rpc("reopen_fiscal_period" as any, { _id: period.id });
    if (error) return toast.error(error.message);
    toast.success("Período reabierto");
    onDone();
  };
  if (period.status === "open") {
    return <Button size="sm" variant="outline" onClick={close}>Cerrar</Button>;
  }
  if (role === "superadmin") {
    return <Button size="sm" variant="ghost" onClick={reopen}>Reabrir</Button>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function YearCloseButton({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    const yr = prompt("¿Qué año cerrar? (ej. " + new Date().getFullYear() + ")");
    if (!yr) return;
    const year = parseInt(yr, 10);
    if (!year || year < 2000) return toast.error("Año inválido");
    if (!window.confirm(`Generar asiento de cierre del año ${year}? Transfiere ingresos/costos/gastos a Utilidades Retenidas.`)) return;
    setLoading(true);
    const { error } = await supabase.rpc("close_fiscal_year" as any, { _org: orgId, _year: year });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Cierre de ejercicio ${year} generado`);
    onDone();
  };
  return <Button size="sm" variant="outline" onClick={run} disabled={loading}>Cierre de ejercicio…</Button>;
}

// ============ Reportes para el contador ============
const STATUS_TONE: Record<string, string> = {
  accepted: "bg-green-50 text-green-700 border-green-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sending: "bg-amber-50 text-amber-700 border-amber-200",
  retrying: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  error: "bg-red-50 text-red-700 border-red-200",
  dead_letter: "bg-red-100 text-red-800 border-red-300",
  void: "bg-gray-100 text-gray-700 border-gray-200",
};

function AccountantReports(props: {
  orgId: string; orgName: string;
  from: string; to: string;
  setFrom: (s: string) => void; setTo: (s: string) => void;
  accounts: Account[];
  fmt: (n: number) => string;
}) {
  const { orgId, orgName, from, to, setFrom, setTo, accounts, fmt } = props;
  const [docType, setDocType] = useState<string>("");
  const [accountCode, setAccountCode] = useState<string>(accounts[0]?.code ?? "");

  const einvQ = useQuery({
    queryKey: ["acc_einv", orgId, from, to, docType],
    enabled: !!orgId,
    queryFn: async (): Promise<EInvoiceRow[]> => {
      const { data, error } = await supabase.rpc("report_einvoices_for_accountant" as any, {
        _org_id: orgId, _from: from, _to: to, _doc_type: docType || null,
      });
      if (error) throw error;
      return (data ?? []) as EInvoiceRow[];
    },
  });

  const vatQ = useQuery({
    queryKey: ["acc_vat", orgId, from, to],
    enabled: !!orgId,
    queryFn: async (): Promise<VatRow[]> => {
      const { data, error } = await supabase.rpc("report_vat_summary" as any, {
        _org_id: orgId, _from: from, _to: to,
      });
      if (error) throw error;
      return (data ?? []) as VatRow[];
    },
  });

  const ledgerQ = useQuery({
    queryKey: ["acc_ledger", orgId, accountCode, from, to],
    enabled: !!orgId && !!accountCode,
    queryFn: async (): Promise<LedgerRow[]> => {
      const { data, error } = await supabase.rpc("report_account_ledger" as any, {
        _org_id: orgId, _account_code: accountCode, _from: from, _to: to,
      });
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
  });

  const einvTotals = (einvQ.data ?? []).reduce(
    (a, r) => {
      const s = docSign(r.document_type);
      return {
        sub: a.sub + Number(r.subtotal || 0),
        tax: a.tax + Number(r.tax_total || 0),
        tot: a.tot + Number(r.total || 0),
        subNet: a.subNet + s * Number(r.subtotal || 0),
        taxNet: a.taxNet + s * Number(r.tax_total || 0),
        totNet: a.totNet + s * Number(r.total || 0),
        notes: a.notes + (r.document_type === "credit_note" ? Number(r.total || 0) : 0),
      };
    },
    { sub: 0, tax: 0, tot: 0, subNet: 0, taxNet: 0, totNet: 0, notes: 0 }
  );
  const vatTotals = (vatQ.data ?? []).reduce(
    (a, r) => ({ base: a.base + Number(r.base_amount || 0), iva: a.iva + Number(r.tax_amount || 0) }),
    { base: 0, iva: 0 }
  );
  const accName = accounts.find((a) => a.code === accountCode)?.name ?? "";

  return (
    <div className="space-y-3">
      {/* Filtros globales */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Desde</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hasta</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" onClick={() => { einvQ.refetch(); vatQ.refetch(); ledgerQ.refetch(); }}>
            <RefreshCw className="w-3 h-3 mr-1" />Actualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Estos reportes son los que tu contador necesita para presentar la declaración del IVA y conciliar las facturas emitidas a la DIAN.
        </p>
      </Card>

      {/* Facturas DIAN */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4" />Facturas Electrónicas DIAN
            <Badge variant="outline">{einvQ.data?.length ?? 0}</Badge>
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Todos los documentos</option>
              <option value="invoice">Facturas</option>
              <option value="credit_note">Notas crédito</option>
              <option value="debit_note">Notas débito</option>
              <option value="support_document">Doc. soporte</option>
            </select>
            <Button size="sm" variant="outline" disabled={!einvQ.data?.length} onClick={() => {
              exportEInvoicesXLSX({ orgName, from, to, rows: einvQ.data ?? [] });
              toast.success("Excel descargado");
            }}>
              <FileDown className="w-3 h-3 mr-1" />Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3 text-xs">
          <div className="rounded-lg border border-gray-100 p-2">
            <div className="text-muted-foreground">Subtotal bruto</div>
            <div className="font-mono font-semibold">{fmt(einvTotals.sub)}</div>
          </div>
          <div className="rounded-lg border border-gray-100 p-2">
            <div className="text-muted-foreground">IVA bruto</div>
            <div className="font-mono font-semibold">{fmt(einvTotals.tax)}</div>
          </div>
          <div className="rounded-lg border border-gray-100 p-2">
            <div className="text-muted-foreground">Total bruto</div>
            <div className="font-mono font-semibold">{fmt(einvTotals.tot)}</div>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50/40 p-2">
            <div className="text-red-700">− Notas crédito</div>
            <div className="font-mono font-semibold text-red-700">{fmt(einvTotals.notes)}</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
            <div className="text-primary">Total neto</div>
            <div className="font-mono font-semibold text-primary">{fmt(einvTotals.totNet)}</div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          El <strong>Total neto</strong> resta las Notas Crédito aceptadas. Las Notas Débito suman. Este es el valor que conciliará tu contador con la declaración de IVA.
        </p>

        {einvQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (einvQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin facturas emitidas en el rango.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>NIT/CC</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>CUFE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {einvQ.data!.slice(0, 200).map((r, i) => {
                  const isNC = r.document_type === "credit_note";
                  const isND = r.document_type === "debit_note";
                  const sign = docSign(r.document_type);
                  return (
                  <TableRow key={`${r.full_number}-${i}`} className={isNC ? "bg-red-50/30" : isND ? "bg-amber-50/30" : ""}>
                    <TableCell className="text-xs whitespace-nowrap">{r.issue_date}</TableCell>
                    <TableCell>
                      {isNC ? <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">NC</Badge>
                        : isND ? <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">ND</Badge>
                        : <Badge variant="outline">FV</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{r.full_number}</div>
                      {r.reference_full_number && (
                        <div className="text-[10px] text-muted-foreground">
                          ↳ Ref: {r.reference_full_number}
                          {r.note_concept_code && <span className="ml-1">· cod {r.note_concept_code}</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">{r.customer_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.customer_identification ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{sign < 0 ? "−" : ""}{fmt(Number(r.subtotal))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{sign < 0 ? "−" : ""}{fmt(Number(r.tax_total))}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">{sign < 0 ? "−" : ""}{fmt(Number(r.total))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[r.status] ?? ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[120px] truncate" title={r.cufe ?? ""}>
                      {r.cufe ? r.cufe.slice(0, 16) + "…" : "—"}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {einvQ.data!.length > 200 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Mostrando 200 de {einvQ.data!.length}. Descarga el Excel para el listado completo.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Resumen de IVA */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />Resumen de IVA por tarifa
          </h3>
          <Button size="sm" variant="outline" disabled={!vatQ.data?.length} onClick={() => {
            exportVatSummaryXLSX({ orgName, from, to, rows: vatQ.data ?? [] });
            toast.success("Excel descargado");
          }}>
            <FileDown className="w-3 h-3 mr-1" />Excel
          </Button>
        </div>
        {vatQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (vatQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin ventas en el rango.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarifa</TableHead>
                <TableHead className="text-right">Base gravable</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vatQ.data!.map((r) => (
                <TableRow key={String(r.tax_rate)}>
                  <TableCell>
                    <Badge variant="outline">{Number(r.tax_rate)}%</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(Number(r.base_amount))}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(Number(r.tax_amount))}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{fmt(Number(r.total_amount))}</TableCell>
                  <TableCell className="text-right text-xs">{r.ticket_count}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell className="font-semibold">Totales</TableCell>
                <TableCell className="text-right font-mono font-semibold">{fmt(vatTotals.base)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{fmt(vatTotals.iva)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{fmt(vatTotals.base + vatTotals.iva)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Libro auxiliar por cuenta */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Search className="w-4 h-4" />Libro auxiliar
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[220px]"
            >
              <option value="">Selecciona una cuenta…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={!ledgerQ.data?.length} onClick={() => {
              exportAccountLedgerXLSX({
                orgName, from, to,
                accountCode, accountName: accName,
                rows: ledgerQ.data ?? [],
              });
              toast.success("Excel descargado");
            }}>
              <FileDown className="w-3 h-3 mr-1" />Excel
            </Button>
          </div>
        </div>

        {!accountCode ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Selecciona una cuenta para ver sus movimientos.</p>
        ) : ledgerQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (ledgerQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin movimientos para {accountCode} en el rango.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerQ.data!.slice(0, 300).map((r) => (
                  <TableRow key={r.entry_id}>
                    <TableCell className="text-xs whitespace-nowrap">{r.entry_date}</TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate">{r.narration ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reference_type ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{Number(r.debit) ? fmt(Number(r.debit)) : ""}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{Number(r.credit) ? fmt(Number(r.credit)) : ""}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">{fmt(Number(r.running_balance))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
