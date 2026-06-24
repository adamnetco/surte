import { useMemo, useState } from "react";
import { ArrowLeftRight, ShieldAlert, Receipt, Loader2, Wallet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFxCurrencies, useFxPairs, useFxLatestRates } from "../hooks/useFx";
import {
  useCreateFxTransaction,
  useFxTransactionsRecent,
  useUiafThreshold,
  useEmitFxCommissionInvoice,
  useFxCustomerMonthly,
} from "../hooks/useFxTransactions";
import { useActiveFxCashSession } from "../hooks/useFxCashSession";
import CloseFxSessionDialog from "../components/CloseFxSessionDialog";

const fmt = (n: number, decimals = 2) =>
  Number.isFinite(n) ? n.toLocaleString("es-CO", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) : "—";

/**
 * Pantalla POS para operaciones de Casa de Cambio.
 * Slice 3: captura de operación + cálculo automático + validación umbral UIAF.
 */
export default function PosFxPage() {
  const { data: currencies = [], isLoading: loadingC } = useFxCurrencies();
  const { data: pairs = [], isLoading: loadingP } = useFxPairs();
  const { data: latestRates = {} } = useFxLatestRates();
  const { data: threshold } = useUiafThreshold();
  const { data: recent = [] } = useFxTransactionsRecent(10);
  const createTx = useCreateFxTransaction();
  const emitCommission = useEmitFxCommissionInvoice();
  const { data: activeSession } = useActiveFxCashSession();
  const [closeOpen, setCloseOpen] = useState(false);

  const [pairId, setPairId] = useState<string>("");
  const [operation, setOperation] = useState<"buy" | "sell">("buy");
  const [fromAmount, setFromAmount] = useState<string>("");
  const [customer, setCustomer] = useState({
    doc_type: "CC",
    doc_number: "",
    name: "",
    address: "",
    occupation: "",
    funds_origin: "",
  });

  const pair = pairs.find((p) => p.id === pairId);
  const baseCcy = currencies.find((c) => c.id === pair?.base_currency_id);
  const quoteCcy = currencies.find((c) => c.id === pair?.quote_currency_id);
  const rate = pair ? latestRates[pair.id] : undefined;

  // operation buy = casa COMPRA divisa base al cliente → entrega quote (buy_rate)
  // operation sell = casa VENDE divisa base al cliente → recibe quote (sell_rate)
  const rateApplied = rate ? (operation === "buy" ? rate.buy_rate : rate.sell_rate) : 0;
  const midRate = rate ? (Number(rate.buy_rate) + Number(rate.sell_rate)) / 2 : 0;
  const fromCcy = operation === "buy" ? baseCcy : quoteCcy;
  const toCcy = operation === "buy" ? quoteCcy : baseCcy;
  const fromAmountNum = Number(fromAmount) || 0;
  const toAmount = useMemo(() => {
    if (!rateApplied || !fromAmountNum) return 0;
    // base/quote: 1 base = rate quote. buy → from(base)*rate. sell → from(quote)/rate.
    return operation === "buy" ? fromAmountNum * rateApplied : fromAmountNum / rateApplied;
  }, [fromAmountNum, rateApplied, operation]);

  // Margen (comisión implícita) = diferencia entre la tasa aplicada y la tasa media,
  // expresada en la divisa quote (la que cotiza el par). Siempre positiva para la casa.
  const commission = useMemo(() => {
    if (!rate || !fromAmountNum || !midRate) return { amount: 0, currencyId: quoteCcy?.id };
    const baseUnits = operation === "buy" ? fromAmountNum : toAmount;
    const perUnit = operation === "buy" ? midRate - rateApplied : rateApplied - midRate;
    return { amount: Math.max(0, baseUnits * perUnit), currencyId: quoteCcy?.id };
  }, [rate, fromAmountNum, midRate, rateApplied, operation, toAmount, quoteCcy?.id]);

  // Cálculo umbral UIAF: si alguna divisa de la operación coincide con la moneda del umbral,
  // comparamos directo; si no, mostramos advertencia (no podemos convertir sin par cruzado).
  const thresholdAmount = threshold?.amount ?? 10000;
  const thresholdCcy = threshold?.currency ?? "USD";
  const thresholdEquivalent = useMemo<number | null>(() => {
    if (fromCcy?.code === thresholdCcy) return fromAmountNum;
    if (toCcy?.code === thresholdCcy) return toAmount;
    return null;
  }, [fromCcy, toCcy, fromAmountNum, toAmount, thresholdCcy]);

  const isAboveThreshold =
    thresholdEquivalent !== null && thresholdEquivalent >= thresholdAmount;
  const thresholdUnknown = thresholdEquivalent === null && fromAmountNum > 0;

  // Slice 4 — Ola 2: acumulado mensual UIAF por cliente.
  const monthlyQ = useFxCustomerMonthly(customer.doc_number);
  const monthly = monthlyQ.data;
  const projectedMonthly = (monthly?.accumulated ?? 0) + (thresholdEquivalent ?? 0);
  const exceedsMonthly =
    !!monthly &&
    (monthly.exceeds || projectedMonthly >= thresholdAmount) &&
    monthly.currency === thresholdCcy;

  const requiresCustomer = isAboveThreshold || exceedsMonthly;
  const customerComplete =
    customer.doc_number.trim().length > 3 &&
    customer.name.trim().length > 2 &&
    customer.funds_origin.trim().length > 2;

  const canSubmit =
    !!pair &&
    !!rate &&
    fromAmountNum > 0 &&
    toAmount > 0 &&
    (!requiresCustomer || customerComplete) &&
    !createTx.isPending;

  const handleSubmit = async () => {
    if (!pair || !fromCcy || !toCcy || !rate) return;
    await createTx.mutateAsync({
      pair_id: pair.id,
      operation,
      from_currency_id: fromCcy.id,
      to_currency_id: toCcy.id,
      from_amount: Number(fromAmountNum.toFixed(2)),
      to_amount: Number(toAmount.toFixed(2)),
      rate_applied: Number(rateApplied.toFixed(6)),
      mid_rate: Number(midRate.toFixed(6)),
      commission_amount: Number(commission.amount.toFixed(2)),
      commission_currency_id: commission.currencyId ?? null,
      is_above_threshold: isAboveThreshold,
      customer_doc_type: requiresCustomer ? customer.doc_type : null,
      customer_doc_number: requiresCustomer ? customer.doc_number.trim() : null,
      customer_name: requiresCustomer ? customer.name.trim() : null,
      customer_address: requiresCustomer ? customer.address.trim() || null : null,
      customer_occupation: requiresCustomer ? customer.occupation.trim() || null : null,
      funds_origin: requiresCustomer ? customer.funds_origin.trim() : null,
    });
    setFromAmount("");
    setCustomer({ doc_type: "CC", doc_number: "", name: "", address: "", occupation: "", funds_origin: "" });
  };

  if (loadingC || loadingP) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando configuración FX…
      </div>
    );
  }

  if (!pairs.length) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-base">Configura tu casa de cambio primero</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No hay pares de divisas configurados. Ve a <a href="/casas-de-cambio" className="underline">Casas de Cambio</a> para crear divisas, pares y cotizaciones.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <div className="max-w-7xl mx-auto p-4 md:p-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">POS · Casa de Cambio</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCloseOpen(true)}
              disabled={!activeSession}
              title={activeSession ? "Arqueo multi-divisa" : "Sin sesión de caja abierta"}
            >
              <Wallet className="h-4 w-4 mr-1.5" />
              Cerrar caja FX
            </Button>
          </div>
          <CloseFxSessionDialog open={closeOpen} onOpenChange={setCloseOpen} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Nueva operación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Par de divisas</Label>
                  <Select value={pairId} onValueChange={setPairId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un par" /></SelectTrigger>
                    <SelectContent>
                      {pairs.map((p) => {
                        const b = currencies.find((c) => c.id === p.base_currency_id);
                        const q = currencies.find((c) => c.id === p.quote_currency_id);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            {b?.code}/{q?.code}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Operación</Label>
                  <Select value={operation} onValueChange={(v: any) => setOperation(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Compra ({baseCcy?.code ?? "base"} → {quoteCcy?.code ?? "quote"})</SelectItem>
                      <SelectItem value="sell">Venta ({quoteCcy?.code ?? "quote"} → {baseCcy?.code ?? "base"})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pair && !rate && (
                <Alert variant="destructive">
                  <AlertTitle>Par sin cotización</AlertTitle>
                  <AlertDescription>
                    Registra una cotización en <a href="/casas-de-cambio" className="underline">Casas de Cambio</a> antes de operar.
                  </AlertDescription>
                </Alert>
              )}

              {rate && (
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Compra: <strong className="text-foreground font-mono">{fmt(rate.buy_rate, 4)}</strong></span>
                  <span>Venta: <strong className="text-foreground font-mono">{fmt(rate.sell_rate, 4)}</strong></span>
                  <span>Media: <strong className="text-foreground font-mono">{fmt(midRate, 4)}</strong></span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Spread: <strong className="font-mono">{fmt(Number(rate.sell_rate) - Number(rate.buy_rate), 4)}</strong> {quoteCcy?.code}
                  </span>
                  <Badge variant="secondary" className="text-[10px] uppercase">{rate.source}</Badge>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Entrega cliente ({fromCcy?.code ?? "—"})</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Recibe cliente ({toCcy?.code ?? "—"})</Label>
                  <div className="h-10 px-3 rounded-md border bg-muted/40 flex items-center justify-end font-mono text-lg">
                    {fmt(toAmount, toCcy?.decimals ?? 2)}
                  </div>
                </div>
              </div>

              {commission.amount > 0 && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Margen estimado de la operación
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Calculado contra la tasa media · base imponible para la factura de comisión.
                    </div>
                  </div>
                  <div className="font-mono text-lg text-emerald-700 dark:text-emerald-300">
                    {fmt(commission.amount, 2)} {quoteCcy?.code}
                  </div>
                </div>
              )}

              {isAboveThreshold && (
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Operación sobre umbral UIAF</AlertTitle>
                  <AlertDescription>
                    Esta operación equivale a {fmt(thresholdEquivalent ?? 0)} {thresholdCcy} y supera el umbral de {fmt(thresholdAmount)} {thresholdCcy}. Datos del cliente obligatorios.
                  </AlertDescription>
                </Alert>
              )}
              {thresholdUnknown && (
                <Alert variant="destructive">
                  <AlertTitle>No se puede verificar umbral UIAF</AlertTitle>
                  <AlertDescription>
                    Ninguna divisa del par coincide con la moneda del umbral ({thresholdCcy}). Capture el cliente manualmente si la operación lo amerita.
                  </AlertDescription>
                </Alert>
              )}

              {exceedsMonthly && !isAboveThreshold && (
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Acumulado mensual UIAF superado</AlertTitle>
                  <AlertDescription>
                    Este documento acumula {fmt(monthly?.accumulated ?? 0)} {thresholdCcy} este mes ({monthly?.txCount ?? 0} operaciones). Sumando esta operación llega a {fmt(projectedMonthly)} {thresholdCcy}, igual o superior al umbral de {fmt(thresholdAmount)} {thresholdCcy}. Datos del cliente obligatorios.
                  </AlertDescription>
                </Alert>
              )}

              {requiresCustomer && (
                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datos del cliente (UIAF)</div>
                    {monthly && monthly.txCount > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono text-right">
                        Mes: {fmt(monthly.accumulated)} {monthly.currency} · {monthly.txCount} op.
                        {monthly.crossCount > 0 && ` · ${monthly.crossCount} cross`}
                        {monthly.missingRateCount > 0 && (
                          <span className="block text-amber-600">
                            {monthly.missingRateCount} op. sin cotización publicada (no contadas)
                          </span>
                        )}
                      </span>
                    )}

                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Tipo doc.</Label>
                      <Select value={customer.doc_type} onValueChange={(v) => setCustomer({ ...customer, doc_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">CC</SelectItem>
                          <SelectItem value="CE">CE</SelectItem>
                          <SelectItem value="PA">Pasaporte</SelectItem>
                          <SelectItem value="NIT">NIT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Número documento *</Label>
                      <Input value={customer.doc_number} onChange={(e) => setCustomer({ ...customer, doc_number: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Nombre completo *</Label>
                      <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ocupación</Label>
                      <Input value={customer.occupation} onChange={(e) => setCustomer({ ...customer, occupation: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label>Dirección</Label>
                      <Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label>Origen de los fondos *</Label>
                      <Input
                        placeholder="Salario, ahorros, venta de bienes, etc."
                        value={customer.funds_origin}
                        onChange={(e) => setCustomer({ ...customer, funds_origin: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button size="lg" className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
                {createTx.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
                Registrar operación
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Umbral UIAF</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="font-mono text-lg">{fmt(thresholdAmount)} {thresholdCcy}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Configurable por organización. Operaciones iguales o superiores exigen captura de cliente.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Últimas operaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {recent.length === 0 && <div className="text-muted-foreground">Sin operaciones aún.</div>}
              {recent.map((t: any) => {
                const f = currencies.find((c) => c.id === t.from_currency_id);
                const to = currencies.find((c) => c.id === t.to_currency_id);
                return (
                  <div key={t.id} className="flex items-start justify-between border-b border-border/50 py-1.5 last:border-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono truncate">{fmt(Number(t.from_amount))} {f?.code} → {fmt(Number(t.to_amount))} {to?.code}</div>
                      <div className="text-muted-foreground text-[10px] flex items-center gap-1.5 flex-wrap">
                        <span>{new Date(t.created_at).toLocaleString("es-CO")}</span>
                        {Number(t.commission_amount) > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                            · margen {fmt(Number(t.commission_amount), 2)}
                          </span>
                        )}
                      </div>
                      {Number(t.commission_amount) > 0 &&
                        (t.commission_invoice_status === "pending" || t.commission_invoice_status === "failed") && (
                          <Button
                            size="sm"
                            variant={t.commission_invoice_status === "failed" ? "destructive" : "outline"}
                            className="h-7 mt-1.5 text-[11px] gap-1"
                            disabled={emitCommission.isPending && emitCommission.variables === t.id}
                            onClick={() => emitCommission.mutate(t.id)}
                          >
                            {emitCommission.isPending && emitCommission.variables === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            {t.commission_invoice_status === "failed" ? "Reintentar factura" : "Facturar comisión"}
                          </Button>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      {t.is_above_threshold && <Badge variant="outline" className="text-[10px]">UIAF</Badge>}
                      {t.commission_invoice_status === "emitted" && <Badge className="text-[10px]" variant="secondary">FE</Badge>}
                      {t.commission_invoice_status === "queued" && <Badge className="text-[10px]" variant="outline">FE…</Badge>}
                      {t.commission_invoice_status === "failed" && (
                        <Badge
                          className="text-[10px]"
                          variant="destructive"
                          title={
                            (t.commission_invoice_last_error
                              ? `Último error: ${t.commission_invoice_last_error}\n`
                              : "") +
                            (t.commission_invoice_next_retry_at
                              ? `Próximo reintento: ${new Date(t.commission_invoice_next_retry_at).toLocaleString("es-CO")}`
                              : (Number(t.commission_invoice_retry_count ?? 0) >= 5
                                  ? "Reintentos automáticos agotados"
                                  : "Reintento automático pendiente"))
                          }
                        >
                          FE err{Number(t.commission_invoice_retry_count ?? 0) > 0 ? ` ×${t.commission_invoice_retry_count}` : ""}
                        </Badge>
                      )}

                      {t.commission_invoice_status === "skipped" && <Badge className="text-[10px]" variant="outline">s/margen</Badge>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
