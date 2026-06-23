import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, ShieldCheck, Trash2, Plus, RefreshCcw } from "lucide-react";
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
  type FxFraudAlert,
  type FxFraudRule,
} from "../hooks/useFxFraud";

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
};

function formatParams(rule: FxFraudRule): string {
  const p = rule.params ?? {};
  if (!Object.keys(p).length) return "—";
  return Object.entries(p)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default function FxFraudPage() {
  const [alertStatus, setAlertStatus] = useState<FxFraudAlert["status"] | "all">("open");
  const rulesQ = useFxFraudRules();
  const seedRules = useSeedDefaultFraudRules();
  const updateRule = useUpdateFraudRule();
  const alertsQ = useFxFraudAlerts(alertStatus);
  const updateAlert = useUpdateFraudAlert();
  const watchQ = useFxFraudWatchlist();
  const addWatch = useAddWatchlistEntry();
  const removeWatch = useRemoveWatchlistEntry();

  const [newDoc, setNewDoc] = useState({ doc_type: "CC", doc_number: "", full_name: "", reason: "" });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

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

  const rules = rulesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const watch = (watchQ.data ?? []).filter((w) => w.is_active);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Anti-fraude FX</h1>
            <p className="text-sm text-muted-foreground">
              Reglas automáticas, alertas y lista de vigilancia para operaciones de cambio
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            Alertas {alerts.length > 0 && <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
          <TabsTrigger value="watchlist">Vigilancia</TabsTrigger>
        </TabsList>

        {/* ALERTS */}
        <TabsContent value="alerts" className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Estado:</Label>
              <Select value={alertStatus} onValueChange={(v) => setAlertStatus(v as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abiertas</SelectItem>
                  <SelectItem value="reviewed">Revisadas</SelectItem>
                  <SelectItem value="dismissed">Descartadas</SelectItem>
                  <SelectItem value="escalated">Escaladas</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => alertsQ.refetch()}>
              <RefreshCcw className="h-4 w-4 mr-1" /> Refrescar
            </Button>
          </div>

          {alertsQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!alertsQ.isLoading && alerts.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-success" />
                Sin alertas en este estado
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {alerts.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity.toUpperCase()}</Badge>
                        <Badge variant="outline">{a.rule_code}</Badge>
                        <Badge variant="secondary">{a.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{a.reason}</p>
                      {Object.keys(a.details ?? {}).length > 0 && (
                        <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                          {JSON.stringify(a.details, null, 2)}
                        </pre>
                      )}
                      {a.transaction_id && (
                        <p className="text-xs text-muted-foreground">
                          Transacción: <code>{a.transaction_id}</code>
                        </p>
                      )}
                    </div>
                  </div>
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
