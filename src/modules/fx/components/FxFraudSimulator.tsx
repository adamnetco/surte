import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, ShieldCheck, ShieldAlert } from "lucide-react";
import { simulateFraudRules, type SimulatedTx } from "../lib/fraudSimulator";
import {
  useFxFraudRules,
  useFxFraudWatchlist,
  useFraudDailyAggregate,
} from "../hooks/useFxFraud";

const SEVERITY_VARIANT = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
} as const;

const EMPTY: SimulatedTx = {
  operation: "sell",
  cop_amount: 0,
  customer_doc_type: "CC",
  customer_doc_number: "",
  customer_name: "",
  customer_address: "",
  customer_occupation: "",
  funds_origin: "",
};

export function FxFraudSimulator() {
  const [tx, setTx] = useState<SimulatedTx>(EMPTY);
  const [uiafThresholdCop, setUiafThresholdCop] = useState<number>(10_000_000);
  const rulesQ = useFxFraudRules();
  const watchQ = useFxFraudWatchlist();
  const aggQ = useFraudDailyAggregate(tx.customer_doc_number || undefined, 60);

  const hits = useMemo(() => {
    if (!rulesQ.data) return [];
    return simulateFraudRules(tx, {
      rules: rulesQ.data,
      watchlist: watchQ.data ?? [],
      uiafThresholdCop,
      daily: {
        ops_today: aggQ.data?.ops_today ?? 0,
        amount_today_cop: 0, // monto COP histórico desconocido; usuario lo proyecta con cop_amount actual
        ops_last_window: aggQ.data?.ops_last_window ?? 0,
        window_minutes: 60,
      },
    });
  }, [tx, rulesQ.data, watchQ.data, aggQ.data, uiafThresholdCop]);

  const update = <K extends keyof SimulatedTx>(k: K, v: SimulatedTx[K]) =>
    setTx((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Datos de la operación a simular
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Evalúa contra reglas activas y la lista de vigilancia <strong>sin guardar</strong> la operación.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Operación</Label>
            <Select value={tx.operation} onValueChange={(v) => update("operation", v as "buy" | "sell")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Compra de divisa</SelectItem>
                <SelectItem value="sell">Venta de divisa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Monto equivalente COP</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={tx.cop_amount || ""}
              onChange={(e) => update("cop_amount", Number(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs">Umbral UIAF (COP)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={uiafThresholdCop}
              onChange={(e) => setUiafThresholdCop(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Tipo doc</Label>
            <Select value={tx.customer_doc_type} onValueChange={(v) => update("customer_doc_type", v)}>
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
            <Label className="text-xs">Número documento</Label>
            <Input
              value={tx.customer_doc_number ?? ""}
              onChange={(e) => update("customer_doc_number", e.target.value)}
              placeholder="Se busca histórico del día"
            />
          </div>
          <div>
            <Label className="text-xs">Nombre cliente</Label>
            <Input value={tx.customer_name ?? ""} onChange={(e) => update("customer_name", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Dirección</Label>
            <Input value={tx.customer_address ?? ""} onChange={(e) => update("customer_address", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Ocupación</Label>
            <Input value={tx.customer_occupation ?? ""} onChange={(e) => update("customer_occupation", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Origen de fondos</Label>
            <Input value={tx.funds_origin ?? ""} onChange={(e) => update("funds_origin", e.target.value)} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setTx(EMPTY)}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {tx.customer_doc_number && aggQ.data && (
        <p className="text-xs text-muted-foreground">
          Histórico hoy: {aggQ.data.ops_today} operaciones · últimos 60 min: {aggQ.data.ops_last_window}
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {hits.length === 0 ? (
              <>
                <ShieldCheck className="h-4 w-4 text-success" />
                Sin alertas
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-destructive" />
                {hits.length} regla{hits.length === 1 ? "" : "s"} se dispararía{hits.length === 1 ? "" : "n"}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hits.length === 0 && (
            <p className="text-sm text-muted-foreground">
              La operación pasaría sin alertas con los datos actuales.
            </p>
          )}
          {hits.map((h) => (
            <div key={h.rule_code} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={SEVERITY_VARIANT[h.severity]}>{h.severity.toUpperCase()}</Badge>
                <Badge variant="outline">{h.rule_code}</Badge>
                {h.auto_mark_suspicious && <Badge variant="destructive">marca sospechosa</Badge>}
                <span className="text-sm font-medium">{h.rule_name}</span>
              </div>
              <p className="text-sm">{h.reason}</p>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                {JSON.stringify(h.criteria, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
