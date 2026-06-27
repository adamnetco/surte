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
import { BookOpen, Layers, Calendar, RefreshCw } from "lucide-react";
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
      return (data ?? []) as Account[];
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

          {/* Períodos */}
          <TabsContent value="periods" className="space-y-3 mt-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Períodos fiscales</h3>
              {periodsQ.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (periodsQ.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Aún no se han abierto períodos. Slice 4 incluirá apertura/cierre mensual y bloqueo de posting.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Hasta</TableHead>
                      <TableHead>Estado</TableHead>
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
