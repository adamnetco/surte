import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Download, Upload, Radio, Sparkles } from "lucide-react";
import { useFxCurrencies, useFxPairs, useFxLatestRates } from "../hooks/useFx";
import {
  useFxPricingRules,
  useUpsertPricingRule,
  usePublishRate,
  useImportTrm,
  useFxRateHistory,
  applySpread,
  type FxPricingRule,
} from "../hooks/useFxPricing";

export default function FxPricingPage() {
  const { data: currencies = [] } = useFxCurrencies();
  const { data: pairs = [] } = useFxPairs();
  const { data: latestRates = {} } = useFxLatestRates();
  const { data: rules = [] } = useFxPricingRules();
  const upsertRule = useUpsertPricingRule();
  const publish = usePublishRate();
  const importTrm = useImportTrm();

  const currMap = useMemo(() => Object.fromEntries(currencies.map((c) => [c.id, c])), [currencies]);
  const ruleByPair = useMemo(
    () => Object.fromEntries(rules.map((r) => [r.pair_id, r])) as Record<string, FxPricingRule>,
    [rules],
  );

  const [selectedPair, setSelectedPair] = useState<string>("");
  const activePair = selectedPair || pairs[0]?.id || "";
  const { data: history = [] } = useFxRateHistory(activePair, 30);

  const pairLabel = (p: { base_currency_id: string; quote_currency_id: string }) =>
    `${currMap[p.base_currency_id]?.code ?? "?"}/${currMap[p.quote_currency_id]?.code ?? "?"}`;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Motor de precios FX</h1>
            <p className="text-sm text-muted-foreground">
              Reglas de spread, importación TRM y publicación de cotizaciones
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open("/casas-de-cambio/tablero", "_blank")}
        >
          <Radio className="h-4 w-4 mr-2" /> Tablero público
        </Button>
      </header>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Reglas de pricing</TabsTrigger>
          <TabsTrigger value="publish">Publicar tasa</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* RULES */}
        <TabsContent value="rules" className="space-y-3">
          {pairs.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">
              Crea pares de divisas en <strong>Casas de Cambio</strong> primero.
            </CardContent></Card>
          )}
          {pairs.map((p) => {
            const rule = ruleByPair[p.id];
            return <PricingRuleCard key={p.id} pair={p} pairLabel={pairLabel(p)} rule={rule} onSave={(payload) => upsertRule.mutate(payload)} />;
          })}
        </TabsContent>

        {/* PUBLISH */}
        <TabsContent value="publish" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Publicar nueva cotización
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Par</Label>
                  <Select value={activePair} onValueChange={setSelectedPair}>
                    <SelectTrigger><SelectValue placeholder="Selecciona par" /></SelectTrigger>
                    <SelectContent>
                      {pairs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{pairLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={importTrm.isPending || !activePair}
                    onClick={async () => {
                      const res = await importTrm.mutateAsync({ pair_id: activePair, publish: true });
                      if (res.published_rate_id) {
                        // toast handled in mutation
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {importTrm.isPending ? "Importando..." : "Importar TRM y publicar"}
                  </Button>
                </div>
              </div>

              <PublishForm
                pairId={activePair}
                rule={ruleByPair[activePair]}
                onPublish={(p) => publish.mutate(p)}
                isPending={publish.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de cotizaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-w-xs">
                <Select value={activePair} onValueChange={setSelectedPair}>
                  <SelectTrigger><SelectValue placeholder="Selecciona par" /></SelectTrigger>
                  <SelectContent>
                    {pairs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{pairLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Compra</TableHead>
                      <TableHead className="text-right">Venta</TableHead>
                      <TableHead className="text-right">Spread</TableHead>
                      <TableHead>Fuente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin cotizaciones</TableCell></TableRow>
                    )}
                    {history.map((r) => {
                      const spread = r.buy_rate > 0 ? ((r.sell_rate - r.buy_rate) / r.buy_rate) * 100 : 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.effective_at).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{r.base_rate ? Number(r.base_rate).toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-right font-mono">{Number(r.buy_rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{Number(r.sell_rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{spread.toFixed(2)}%</TableCell>
                          <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PricingRuleCard({
  pair, pairLabel: label, rule, onSave,
}: {
  pair: { id: string; base_currency_id: string; quote_currency_id: string };
  pairLabel: string;
  rule?: FxPricingRule;
  onSave: (r: Partial<FxPricingRule> & { pair_id: string }) => void;
}) {
  const [form, setForm] = useState({
    base_source: rule?.base_source ?? "manual",
    spread_buy_pct: rule?.spread_buy_pct ?? 0.5,
    spread_sell_pct: rule?.spread_sell_pct ?? 0.5,
    min_buy: rule?.min_buy ?? null,
    max_buy: rule?.max_buy ?? null,
    min_sell: rule?.min_sell ?? null,
    max_sell: rule?.max_sell ?? null,
    auto_publish: rule?.auto_publish ?? false,
    is_active: rule?.is_active ?? true,
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{label}</CardTitle>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Activa</Label>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </div>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-4 gap-3">
        <div>
          <Label>Fuente base</Label>
          <Select value={form.base_source} onValueChange={(v: any) => setForm({ ...form, base_source: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="trm_banrep">TRM Banrep</SelectItem>
              <SelectItem value="api">API externa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <NumberField label="Spread compra %" value={form.spread_buy_pct} onChange={(v) => setForm({ ...form, spread_buy_pct: v })} />
        <NumberField label="Spread venta %"  value={form.spread_sell_pct} onChange={(v) => setForm({ ...form, spread_sell_pct: v })} />
        <div className="flex items-center justify-between border rounded-md px-3">
          <Label className="text-sm">Auto-publicar TRM</Label>
          <Switch checked={form.auto_publish} onCheckedChange={(v) => setForm({ ...form, auto_publish: v })} />
        </div>
        <NumberField label="Mín compra" value={form.min_buy} onChange={(v) => setForm({ ...form, min_buy: v })} optional />
        <NumberField label="Máx compra" value={form.max_buy} onChange={(v) => setForm({ ...form, max_buy: v })} optional />
        <NumberField label="Mín venta"  value={form.min_sell} onChange={(v) => setForm({ ...form, min_sell: v })} optional />
        <NumberField label="Máx venta"  value={form.max_sell} onChange={(v) => setForm({ ...form, max_sell: v })} optional />
        <div className="sm:col-span-4 flex justify-end">
          <Button onClick={() => onSave({ pair_id: pair.id, ...form })}>Guardar regla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label, value, onChange, optional,
}: { label: string; value: number | null; onChange: (v: number | null) => void; optional?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value ?? ""}
        placeholder={optional ? "Opcional" : "0"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? (optional ? null : 0) : Number(v));
        }}
      />
    </div>
  );
}

function PublishForm({
  pairId, rule, onPublish, isPending,
}: {
  pairId: string;
  rule?: FxPricingRule;
  onPublish: (p: { pair_id: string; buy_rate: number; sell_rate: number; source?: string; base_rate?: number | null }) => void;
  isPending: boolean;
}) {
  const [base, setBase] = useState("");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");

  const baseNum = Number(base) || 0;
  const preview = applySpread(baseNum, rule);

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <NumberField label="Tasa base (opcional)" value={base ? Number(base) : null} onChange={(v) => {
          setBase(v?.toString() ?? "");
          if (v && rule) {
            const p = applySpread(v, rule);
            setBuy(p.buy.toString());
            setSell(p.sell.toString());
          }
        }} optional />
        <NumberField label="Compra" value={buy ? Number(buy) : null} onChange={(v) => setBuy(v?.toString() ?? "")} />
        <NumberField label="Venta"  value={sell ? Number(sell) : null} onChange={(v) => setSell(v?.toString() ?? "")} />
      </div>
      {baseNum > 0 && rule && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
          Preview con regla activa: compra <strong>{preview.buy.toLocaleString()}</strong> · venta <strong>{preview.sell.toLocaleString()}</strong>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          disabled={!pairId || !buy || !sell || isPending}
          onClick={() => onPublish({
            pair_id: pairId,
            buy_rate: Number(buy),
            sell_rate: Number(sell),
            base_rate: base ? Number(base) : null,
            source: rule?.base_source ?? "manual",
          })}
        >
          <Upload className="h-4 w-4 mr-2" /> Publicar
        </Button>
      </div>
    </div>
  );
}
