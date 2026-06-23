import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, ArrowRightLeft, TrendingUp, Plus } from "lucide-react";
import {
  useFxCurrencies, useFxPairs, useFxLatestRates,
  useUpsertCurrency, useCreatePair, useSetRate,
} from "../hooks/useFx";

const SEED_CURRENCIES = [
  { code: "COP", name: "Peso Colombiano", symbol: "$", decimals: 0 },
  { code: "USD", name: "Dólar Estadounidense", symbol: "US$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "VES", name: "Bolívar Venezolano", symbol: "Bs.", decimals: 2 },
];

export default function CasasDeCambioPage() {
  const { data: currencies = [], isLoading: loadingCur } = useFxCurrencies();
  const { data: pairs = [] } = useFxPairs();
  const { data: latestRates = {} } = useFxLatestRates();
  const upsertCurrency = useUpsertCurrency();
  const createPair = useCreatePair();
  const setRate = useSetRate();

  const [newCurr, setNewCurr] = useState({ code: "", name: "", symbol: "", decimals: 2 });
  const [newPair, setNewPair] = useState({ base: "", quote: "" });
  const [rateInputs, setRateInputs] = useState<Record<string, { buy: string; sell: string }>>({});

  const currMap = useMemo(() => Object.fromEntries(currencies.map(c => [c.id, c])), [currencies]);
  const activeCurrencies = currencies.filter(c => c.is_active);

  const seedDefaults = async () => {
    for (const c of SEED_CURRENCIES) {
      if (!currencies.find(x => x.code === c.code)) {
        await upsertCurrency.mutateAsync({ ...c, is_active: true });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Casas de Cambio</h1>
            <p className="text-sm text-muted-foreground">Configuración de divisas, pares y cotizaciones</p>
          </div>
        </div>
        {currencies.length === 0 && (
          <Button onClick={seedDefaults} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Cargar divisas comunes (COP, USD, EUR, VES)
          </Button>
        )}
      </header>

      <Tabs defaultValue="divisas">
        <TabsList>
          <TabsTrigger value="divisas"><Coins className="h-4 w-4 mr-1" /> Divisas</TabsTrigger>
          <TabsTrigger value="pares"><ArrowRightLeft className="h-4 w-4 mr-1" /> Pares</TabsTrigger>
          <TabsTrigger value="cotizaciones"><TrendingUp className="h-4 w-4 mr-1" /> Cotizaciones</TabsTrigger>
        </TabsList>

        {/* DIVISAS */}
        <TabsContent value="divisas" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Agregar divisa</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-5 gap-3 items-end">
              <div><Label>Código ISO</Label><Input maxLength={3} value={newCurr.code} onChange={e => setNewCurr({ ...newCurr, code: e.target.value.toUpperCase() })} placeholder="USD" /></div>
              <div className="md:col-span-2"><Label>Nombre</Label><Input value={newCurr.name} onChange={e => setNewCurr({ ...newCurr, name: e.target.value })} placeholder="Dólar Estadounidense" /></div>
              <div><Label>Símbolo</Label><Input value={newCurr.symbol} onChange={e => setNewCurr({ ...newCurr, symbol: e.target.value })} placeholder="US$" /></div>
              <div><Label>Decimales</Label><Input type="number" min={0} max={6} value={newCurr.decimals} onChange={e => setNewCurr({ ...newCurr, decimals: Number(e.target.value) })} /></div>
              <Button
                className="md:col-span-5"
                disabled={!newCurr.code || !newCurr.name || upsertCurrency.isPending}
                onClick={async () => {
                  await upsertCurrency.mutateAsync({ ...newCurr, is_active: true });
                  setNewCurr({ code: "", name: "", symbol: "", decimals: 2 });
                }}
              >Agregar divisa</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Divisas registradas ({currencies.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loadingCur && <p className="text-sm text-muted-foreground">Cargando…</p>}
              {!loadingCur && currencies.length === 0 && (
                <p className="text-sm text-muted-foreground">Aún no hay divisas. Usa el botón superior para cargar las comunes o agrega manualmente.</p>
              )}
              {currencies.map(c => (
                <div key={c.id} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">{c.code}</Badge>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.symbol ?? "—"} · {c.decimals} decimales</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={async (v) => {
                        await upsertCurrency.mutateAsync({ id: c.id, code: c.code, name: c.name, symbol: c.symbol, decimals: c.decimals, is_active: v });
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{c.is_active ? "Activa" : "Inactiva"}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PARES */}
        <TabsContent value="pares" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Crear par de cambio</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3 items-end">
              <div>
                <Label>Divisa base</Label>
                <Select value={newPair.base} onValueChange={v => setNewPair({ ...newPair, base: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {activeCurrencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Divisa cotizada</Label>
                <Select value={newPair.quote} onValueChange={v => setNewPair({ ...newPair, quote: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {activeCurrencies.filter(c => c.id !== newPair.base).map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={!newPair.base || !newPair.quote || createPair.isPending}
                onClick={async () => {
                  await createPair.mutateAsync({ base_currency_id: newPair.base, quote_currency_id: newPair.quote });
                  setNewPair({ base: "", quote: "" });
                }}
              >Crear par</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pares activos ({pairs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pairs.length === 0 && <p className="text-sm text-muted-foreground">Sin pares todavía.</p>}
              {pairs.map(p => {
                const base = currMap[p.base_currency_id];
                const quote = currMap[p.quote_currency_id];
                const r = latestRates[p.id];
                return (
                  <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="font-mono">{base?.code}/{quote?.code}</Badge>
                      <span className="text-sm text-muted-foreground">{base?.name} → {quote?.name}</span>
                    </div>
                    <div className="text-right text-sm">
                      {r ? (
                        <>
                          <div>Compra <span className="font-mono font-semibold">{r.buy_rate}</span> · Venta <span className="font-mono font-semibold">{r.sell_rate}</span></div>
                          <div className="text-xs text-muted-foreground">Spread: {((r.sell_rate - r.buy_rate) / r.buy_rate * 100).toFixed(2)}%</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin cotización</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COTIZACIONES */}
        <TabsContent value="cotizaciones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Establecer cotización del día</CardTitle>
              <p className="text-xs text-muted-foreground">Cada cambio se guarda como histórico inmutable. Tasa de compra = lo que la casa paga al cliente; venta = lo que cobra.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {pairs.length === 0 && <p className="text-sm text-muted-foreground">Crea pares primero.</p>}
              {pairs.map(p => {
                const base = currMap[p.base_currency_id];
                const quote = currMap[p.quote_currency_id];
                const r = latestRates[p.id];
                const inputs = rateInputs[p.id] ?? { buy: "", sell: "" };
                return (
                  <div key={p.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="default" className="font-mono">{base?.code}/{quote?.code}</Badge>
                      {r && <span className="text-xs text-muted-foreground">Actual: {r.buy_rate} / {r.sell_rate} · {new Date(r.effective_at).toLocaleString("es-CO")}</span>}
                    </div>
                    <div className="grid md:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Tasa de compra</Label>
                        <Input
                          type="number"
                          step="any"
                          value={inputs.buy}
                          onChange={e => setRateInputs({ ...rateInputs, [p.id]: { ...inputs, buy: e.target.value } })}
                          placeholder={r?.buy_rate?.toString() ?? "0.00"}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tasa de venta</Label>
                        <Input
                          type="number"
                          step="any"
                          value={inputs.sell}
                          onChange={e => setRateInputs({ ...rateInputs, [p.id]: { ...inputs, sell: e.target.value } })}
                          placeholder={r?.sell_rate?.toString() ?? "0.00"}
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!inputs.buy || !inputs.sell || setRate.isPending}
                        onClick={async () => {
                          await setRate.mutateAsync({
                            pair_id: p.id,
                            buy_rate: Number(inputs.buy),
                            sell_rate: Number(inputs.sell),
                            source: "manual",
                          });
                          setRateInputs({ ...rateInputs, [p.id]: { buy: "", sell: "" } });
                        }}
                      >Actualizar cotización</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
