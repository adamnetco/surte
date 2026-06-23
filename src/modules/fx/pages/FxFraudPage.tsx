import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, ShieldCheck, Trash2, Plus, RefreshCcw, Download, Search, Radio } from "lucide-react";
import { toast } from "sonner";
import {
  useFxFraudRules,
  useSeedDefaultFraudRules,
  useUpdateFraudRule,
  useFxFraudAlerts,
  useUpdateFraudAlert,
  useFxFraudWatchlist,
  useAddWatchlistEntry,
  useRemoveWatchlistEntry,
  useFxFraudAlertsRealtime,
  type FxFraudAlert,
  type FxFraudRule,
} from "../hooks/useFxFraud";
import { downloadFraudAlertsCsv } from "../lib/fraudCsvExport";
import { FxFraudSimulator } from "../components/FxFraudSimulator";

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
};

const CRITERIA_LABELS: Record<string, string> = {
  ops_today: "Operaciones hoy",
  projected: "Proyectado",
  projected_cop: "Proyectado (COP)",
  max_ops_per_day: "Máx. ops por día",
  amount_today_cop: "Acumulado hoy (COP)",
  tx_cop: "Monto operación (COP)",
  max_amount_per_day_cop: "Máx. monto por día (COP)",
  ops_last_window: "Operaciones en ventana",
  window_minutes: "Ventana (min)",
  max_ops: "Máx. operaciones",
  threshold_cop: "Umbral (COP)",
  uiaf_threshold_cop: "Umbral UIAF (COP)",
  missing_fields: "Datos faltantes",
  doc_type: "Tipo doc",
  doc_number: "Documento",
  full_name: "Nombre",
  watchlist_reason: "Motivo vigilancia",
};

function formatParams(rule: FxFraudRule): string {
  const p = rule.params ?? {};
  if (!Object.keys(p).length) return "—";
  return Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

function CriteriaPanel({ alert }: { alert: FxFraudAlert }) {
  const details = alert.details ?? {};
  const entries = Object.entries(details);
  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{alert.rule_code}</Badge>
        <span className="text-xs text-muted-foreground">Razón del disparo</span>
      </div>
      <p className="text-sm">{alert.reason}</p>
      {entries.length > 0 && (
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {entries.map(([k, v]) => (
            <div key={k} className="bg-background rounded border p-2">
              <dt className="text-muted-foreground">{CRITERIA_LABELS[k] ?? k}</dt>
              <dd className="font-medium break-words">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function FxFraudPage() {
  useFxFraudAlertsRealtime();

  const [alertStatus, setAlertStatus] = useState<FxFraudAlert["status"] | "all" | "closed">("open");
  const [severityFilter, setSeverityFilter] = useState<"all" | FxFraudAlert["severity"]>("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Para "closed" pedimos todas y filtramos cliente; para el resto, filtramos en query.
  const queryStatus = alertStatus === "closed" ? "all" : alertStatus;
  const alertsQ = useFxFraudAlerts(queryStatus as any);
  const rulesQ = useFxFraudRules();
  const seedRules = useSeedDefaultFraudRules();
  const updateRule = useUpdateFraudRule();
  const updateAlert = useUpdateFraudAlert();
  const watchQ = useFxFraudWatchlist();
  const addWatch = useAddWatchlistEntry();
  const removeWatch = useRemoveWatchlistEntry();

  const [newDoc, setNewDoc] = useState({ doc_type: "CC", doc_number: "", full_name: "", reason: "" });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const rules = rulesQ.data ?? [];
  const watch = (watchQ.data ?? []).filter((w) => w.is_active);

  const filteredAlerts = useMemo(() => {
    const all = alertsQ.data ?? [];
    const term = search.trim().toLowerCase();
    return all.filter((a) => {
      if (alertStatus === "closed" && a.status === "open") return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (ruleFilter !== "all" && a.rule_code !== ruleFilter) return false;
      if (term) {
        const hay = `${a.reason} ${a.rule_code} ${a.transaction_id ?? ""} ${JSON.stringify(a.details ?? {})}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [alertsQ.data, alertStatus, severityFilter, ruleFilter, search]);

  const openCount = (alertsQ.data ?? []).filter((a) => a.status === "open").length;

  const handleSeed = async () => {
    try {
      await seedRules.mutateAsync();
      toast.success("Reglas por defecto cargadas");
    } catch (e: any) {
      toast.error(e.message ?? "Error al cargar reglas");
    }
  };

  const handleToggleRule = async (rule: FxFraudRule, key: "is_active" | "auto_mark_suspicious", value: boolean) => {
    try {
      await updateRule.mutateAsync({ id: rule.id, [key]: value });
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  };

  const handleUpdateAlert = async (id: string, status: FxFraudAlert["status"]) => {
    try {
      await updateAlert.mutateAsync({ id, status, review_notes: reviewNotes[id] });
      toast.success("Alerta actualizada");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  };

  const handleAddWatch = async () => {
    if (!newDoc.doc_number.trim()) {
      toast.error("Documento requerido");
      return;
    }
    try {
      await addWatch.mutateAsync(newDoc);
      setNewDoc({ doc_type: "CC", doc_number: "", full_name: "", reason: "" });
      toast.success("Cliente agregado a vigilancia");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  };

  const handleExport = () => {
    if (!filteredAlerts.length) {
      toast.error("Sin alertas para exportar");
      return;
    }
    downloadFraudAlertsCsv(
      filteredAlerts,
      `alertas-anti-fraude-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(`Exportadas ${filteredAlerts.length} alertas`);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Anti-fraude FX</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Reglas, alertas en tiempo real y simulador de operaciones
              <Badge variant="outline" className="gap-1">
                <Radio className="h-3 w-3 text-success animate-pulse" /> Realtime
              </Badge>
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            Alertas {openCount > 0 && <Badge variant="destructive" className="ml-2">{openCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
          <TabsTrigger value="watchlist">Vigilancia</TabsTrigger>
        </TabsList>

        {/* ALERTS */}
        <TabsContent value="alerts" className="space-y-3">
          <Card>
            <CardContent className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Razón, regla, transacción…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={alertStatus} onValueChange={(v) => setAlertStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abiertas</SelectItem>
                    <SelectItem value="closed">Cerradas</SelectItem>
                    <SelectItem value="reviewed">Revisadas</SelectItem>
                    <SelectItem value="dismissed">Descartadas</SelectItem>
                    <SelectItem value="escalated">Escaladas</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Severidad</Label>
                <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Regla</Label>
                <Select value={ruleFilter} onValueChange={setRuleFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Array.from(new Set((alertsQ.data ?? []).map((a) => a.rule_code))).map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-5 flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => alertsQ.refetch()}>
                  <RefreshCcw className="h-4 w-4 mr-1" /> Refrescar
                </Button>
                <Button size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-1" /> Exportar CSV ({filteredAlerts.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {alertsQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!alertsQ.isLoading && filteredAlerts.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-success" />
                Sin alertas que coincidan con los filtros
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {filteredAlerts.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity.toUpperCase()}</Badge>
                      <Badge variant={a.status === "open" ? "destructive" : "secondary"}>
                        {a.status === "open" ? "ABIERTA" : "CERRADA"}
                      </Badge>
                      <Badge variant="outline">{a.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    {a.transaction_id && (
                      <code className="text-xs text-muted-foreground">tx: {a.transaction_id.slice(0, 8)}…</code>
                    )}
                  </div>

                  <CriteriaPanel alert={a} />

                  {a.status === "open" && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Notas de revisión (opcional)"
                        value={reviewNotes[a.id] ?? ""}
                        onChange={(e) => setReviewNotes((p) => ({ ...p, [a.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" onClick={() => handleUpdateAlert(a.id, "reviewed")}>
                          Marcar revisada
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateAlert(a.id, "dismissed")}>
                          Descartar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleUpdateAlert(a.id, "escalated")}>
                          Escalar a ROS
                        </Button>
                      </div>
                    </div>
                  )}
                  {a.review_notes && (
                    <p className="text-xs text-muted-foreground italic">Nota: {a.review_notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SIMULATOR */}
        <TabsContent value="simulator">
          <FxFraudSimulator />
        </TabsContent>

        {/* RULES */}
        <TabsContent value="rules" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Reglas activas se evalúan al insertar cada transacción FX.
            </p>
            <Button size="sm" variant="outline" onClick={handleSeed} disabled={seedRules.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Cargar reglas por defecto
            </Button>
          </div>

          {rulesQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!rulesQ.isLoading && rules.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No hay reglas configuradas. Carga las reglas por defecto para comenzar.
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {rules.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {r.name}
                        <Badge variant={SEVERITY_VARIANT[r.severity]}>{r.severity}</Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                      <p className="text-xs mt-1">
                        <code>{r.rule_code}</code> · {formatParams(r)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => handleToggleRule(r, "is_active", v)}
                      />
                      <Label className="text-sm">Activa</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.auto_mark_suspicious}
                        onCheckedChange={(v) => handleToggleRule(r, "auto_mark_suspicious", v)}
                      />
                      <Label className="text-sm">Marcar como sospechosa automáticamente</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* WATCHLIST */}
        <TabsContent value="watchlist" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agregar cliente a vigilancia</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <Label className="text-xs">Tipo doc</Label>
                <Select value={newDoc.doc_type} onValueChange={(v) => setNewDoc((p) => ({ ...p, doc_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC">CC</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                    <SelectItem value="NIT">NIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={newDoc.doc_number} onChange={(e) => setNewDoc((p) => ({ ...p, doc_number: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input value={newDoc.full_name} onChange={(e) => setNewDoc((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Motivo</Label>
                <Input value={newDoc.reason} onChange={(e) => setNewDoc((p) => ({ ...p, reason: e.target.value }))} />
              </div>
              <div className="md:col-span-5">
                <Button size="sm" onClick={handleAddWatch} disabled={addWatch.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar
                </Button>
              </div>
            </CardContent>
          </Card>

          {watchQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!watchQ.isLoading && watch.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Lista de vigilancia vacía
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {watch.map((w) => (
              <Card key={w.id}>
                <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {w.doc_type ?? "DOC"} {w.doc_number}
                      {w.full_name ? ` — ${w.full_name}` : ""}
                    </p>
                    {w.reason && <p className="text-xs text-muted-foreground">{w.reason}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm("¿Remover de la lista de vigilancia?")) removeWatch.mutate(w.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
