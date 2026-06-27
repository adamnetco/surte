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
import { BookOpen, Layers, Calendar, RefreshCw, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";

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
