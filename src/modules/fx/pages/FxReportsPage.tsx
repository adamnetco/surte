import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TrendingUp, Download, AlertTriangle, FileText, ArrowRightLeft, Coins, Users, CalendarDays, ShieldAlert } from "lucide-react";
import { useFxCurrencies } from "../hooks/useFx";
import { useFxSummary, monthRange, type MarginBucket } from "../hooks/useFxReports";
import { useUiafThreshold } from "../hooks/useFxTransactions";
import { buildUiafCsv, downloadCsv } from "../lib/uiafExport";
import { buildUiafXml, downloadXml } from "../lib/uiafXml";

import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

export default function FxReportsPage() {
  const { currentOrg } = useOrganization();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const range = useMemo(() => monthRange(year, month), [year, month]);
  const { data: currencies = [] } = useFxCurrencies();
  const { txs, totals, byCurrency, byPair, byCashier, byDay, isLoading } = useFxSummary(range);
  const { data: threshold } = useUiafThreshold();
  const thresholdAmount = threshold?.amount ?? 10000;
  const thresholdCcy = threshold?.currency ?? "USD";

  const currMap = useMemo(
    () => Object.fromEntries(currencies.map((c) => [c.id, { code: c.code, name: c.name }])),
    [currencies],
  );

  // Slice 5 — Ola 2: acumulado mensual por cliente (cliente-side sobre txs ya cargadas).
  type CustomerAcc = {
    docNumber: string;
    name: string;
    accumulated: number;   // en threshold currency (cuando hay match), 0 si no
    txCount: number;
    aboveOps: number;
    suspicious: number;
  };
  const byCustomer = useMemo<CustomerAcc[]>(() => {
    const map = new Map<string, CustomerAcc>();
    for (const t of txs as any[]) {
      const doc = (t.customer_doc_number ?? "").toString().trim();
      if (!doc) continue;
      let acc = map.get(doc);
      if (!acc) {
        acc = { docNumber: doc, name: t.customer_name ?? "—", accumulated: 0, txCount: 0, aboveOps: 0, suspicious: 0 };
        map.set(doc, acc);
      }
      acc.txCount += 1;
      if (t.is_above_threshold) acc.aboveOps += 1;
      if (t.is_suspicious) acc.suspicious += 1;
      const fromCode = currMap[t.from_currency_id]?.code;
      const toCode = currMap[t.to_currency_id]?.code;
      if (fromCode === thresholdCcy) acc.accumulated += Number(t.from_amount) || 0;
      else if (toCode === thresholdCcy) acc.accumulated += Number(t.to_amount) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.accumulated - a.accumulated);
  }, [txs, currMap, thresholdCcy]);

  const customersOverThreshold = byCustomer.filter((c) => c.accumulated >= thresholdAmount);
  const customersNearThreshold = byCustomer.filter(
    (c) => c.accumulated >= thresholdAmount * 0.8 && c.accumulated < thresholdAmount,
  );

  // Resolve cashier names
  const cashierIds = useMemo(
    () => Array.from(new Set(byCashier.map((b) => b.key).filter((k) => k && k !== "—"))),
    [byCashier],
  );
  const [cashierNames, setCashierNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (cashierIds.length === 0) return;
    let cancel = false;
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", cashierIds)
      .then(({ data }) => {
        if (cancel || !data) return;
        setCashierNames(Object.fromEntries(data.map((p: any) => [p.id, p.full_name ?? p.id.slice(0, 8)])));
      });
    return () => { cancel = true; };
  }, [cashierIds.join(",")]);

  const fmtPair = (key: string) => {
    const [a, b] = key.split("__");
    return `${currMap[a]?.code ?? "?"} → ${currMap[b]?.code ?? "?"}`;
  };
  const fmtMargin = (b: MarginBucket) =>
    `${b.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currMap[b.marginCurrencyId ?? ""]?.code ?? ""}`.trim();

  const exportUiaf = () => {
    const csv = buildUiafCsv(txs as any[], currMap);
    const slug = (currentOrg?.slug ?? "org").replace(/[^a-z0-9-]/gi, "");
    downloadCsv(`UIAF-${slug}-${year}-${String(month).padStart(2, "0")}.csv`, csv);
  };

  const exportUiafXml = () => {
    const xml = buildUiafXml(txs as any[], currMap, {
      organizationName: currentOrg?.name ?? "Organización",
      organizationLegalName: (currentOrg as any)?.legal_name ?? null,
      organizationTaxId: (currentOrg as any)?.tax_id ?? null,
      year,
      month,
    });
    const slug = (currentOrg?.slug ?? "org").replace(/[^a-z0-9-]/gi, "");
    downloadXml(`UIAF-${slug}-${year}-${String(month).padStart(2, "0")}.xml`, xml);
  };

  const exportAll = () => {
    const csv = buildUiafCsv(txs as any[], currMap);
    const slug = (currentOrg?.slug ?? "org").replace(/[^a-z0-9-]/gi, "");
    downloadCsv(`FX-operaciones-${slug}-${year}-${String(month).padStart(2, "0")}.csv`, csv);
  };


  const years = Array.from({ length: 5 }, (_, i) => now.getUTCFullYear() - i);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Reportes FX</h1>
            <p className="text-sm text-muted-foreground">
              Resumen mensual de operaciones y exportación UIAF
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label className="text-xs">Mes</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Año</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Operaciones</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.totalOps}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Margen total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums">
              {totals.totalMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {currMap[totals.marginCurrencyId ?? ""]?.code ?? ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Sobre umbral UIAF</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {totals.aboveThreshold}
              {totals.aboveThreshold > 0 && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Sospechosas (ROS)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {totals.suspicious}
              {totals.suspicious > 0 && <Badge variant="destructive">ROS</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Divisas operadas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{Object.keys(byCurrency).length}</div></CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MarginCard
          title="Margen por par"
          icon={<Coins className="h-4 w-4" />}
          buckets={byPair}
          labelFor={(b) => fmtPair(b.label)}
          fmtMargin={fmtMargin}
        />
        <MarginCard
          title="Margen por cajero"
          icon={<Users className="h-4 w-4" />}
          buckets={byCashier}
          labelFor={(b) => cashierNames[b.key] ?? (b.key === "—" ? "Sin asignar" : b.key.slice(0, 8))}
          fmtMargin={fmtMargin}
        />
        <MarginCard
          title="Margen por día"
          icon={<CalendarDays className="h-4 w-4" />}
          buckets={byDay}
          labelFor={(b) => new Date(b.label + "T00:00:00").toLocaleDateString()}
          fmtMargin={fmtMargin}
        />
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Acumulado mensual UIAF por cliente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Umbral configurado: <b>{thresholdAmount.toLocaleString()} {thresholdCcy}</b>.
            Solo se suman operaciones cuya divisa origen o destino coincide con la moneda del umbral.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="border rounded-lg px-3 py-2">
              <div className="text-muted-foreground">Clientes con operaciones</div>
              <div className="text-xl font-bold">{byCustomer.length}</div>
            </div>
            <div className="border rounded-lg px-3 py-2 border-destructive/40">
              <div className="text-muted-foreground">Sobre umbral mensual</div>
              <div className="text-xl font-bold text-destructive">{customersOverThreshold.length}</div>
            </div>
            <div className="border rounded-lg px-3 py-2 border-amber-400/40">
              <div className="text-muted-foreground">Cerca del umbral (≥80%)</div>
              <div className="text-xl font-bold text-amber-600">{customersNearThreshold.length}</div>
            </div>
          </div>

          {byCustomer.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin clientes identificados en el período.</p>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {byCustomer.slice(0, 50).map((c) => {
                const pct = thresholdAmount > 0 ? (c.accumulated / thresholdAmount) * 100 : 0;
                const over = c.accumulated >= thresholdAmount;
                const near = !over && pct >= 80;
                return (
                  <div
                    key={c.docNumber}
                    className={`flex items-center justify-between border rounded-md px-2 py-1.5 text-xs ${
                      over ? "border-destructive/50 bg-destructive/5" : near ? "border-amber-400/50 bg-amber-50/40" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                        <span>Doc: {c.docNumber}</span>
                        <span>{c.txCount} ops</span>
                        {c.aboveOps > 0 && <Badge variant="outline" className="h-4 px-1 text-[9px]">UIAF op {c.aboveOps}</Badge>}
                        {c.suspicious > 0 && <Badge variant="destructive" className="h-4 px-1 text-[9px]">ROS {c.suspicious}</Badge>}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className={`tabular-nums font-semibold ${over ? "text-destructive" : near ? "text-amber-600" : ""}`}>
                        {c.accumulated.toLocaleString(undefined, { maximumFractionDigits: 2 })} {thresholdCcy}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% del umbral</div>
                    </div>
                  </div>
                );
              })}
              {byCustomer.length > 50 && (
                <p className="text-[10px] text-muted-foreground pt-1">
                  Mostrando 50 de {byCustomer.length}. Exporta UIAF para el detalle completo.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-4 w-4" /> Totales por divisa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(byCurrency).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin operaciones en el período.</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(byCurrency).map(([cid, v]) => (
                <div key={cid} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                  <div className="font-medium">{currMap[cid]?.code ?? cid}</div>
                  <div className="flex gap-4 tabular-nums text-xs">
                    <span>Compra: <b>{v.buy.toLocaleString()}</b></span>
                    <span>Venta: <b>{v.sell.toLocaleString()}</b></span>
                    <span className="text-muted-foreground">{v.count} ops</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Exportaciones regulatorias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3 border rounded-lg p-3">
            <div>
              <div className="font-medium text-sm">Reporte UIAF mensual</div>
              <p className="text-xs text-muted-foreground">
                Operaciones del mes con datos de cliente, montos, tasas y marcas de umbral / ROS.
                Descarga en CSV plano o en XML estructurado (Res. UIAF 285) como insumo del reporte oficial.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button onClick={exportUiafXml} disabled={isLoading || txs.length === 0} size="sm">
                <Download className="h-4 w-4 mr-1" /> UIAF XML
              </Button>
              <Button variant="outline" onClick={exportUiaf} disabled={isLoading || txs.length === 0} size="sm">
                <Download className="h-4 w-4 mr-1" /> UIAF CSV
              </Button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 border rounded-lg p-3">
            <div>
              <div className="font-medium text-sm">Histórico completo del mes</div>
              <p className="text-xs text-muted-foreground">
                Misma información en formato plano para conciliación contable interna.
              </p>
            </div>
            <Button variant="outline" onClick={exportAll} disabled={isLoading || txs.length === 0} className="shrink-0">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Operaciones del período ({txs.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin operaciones registradas.</p>
          ) : (
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
              {(txs as any[]).slice(0, 200).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs border rounded-md px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <Badge variant={t.operation === "buy" ? "secondary" : "outline"} className="capitalize">
                      {t.operation === "buy" ? "Compra" : "Venta"}
                    </Badge>
                    <span>
                      {Number(t.from_amount).toLocaleString()} {currMap[t.from_currency_id]?.code} →{" "}
                      {Number(t.to_amount).toLocaleString()} {currMap[t.to_currency_id]?.code}
                    </span>
                    {t.is_above_threshold && <Badge variant="destructive" className="text-[10px]">UIAF</Badge>}
                    {t.is_suspicious && <Badge variant="destructive" className="text-[10px]">ROS</Badge>}
                  </div>
                  <span className="text-muted-foreground">{t.customer_name ?? "—"}</span>
                </div>
              ))}
              {txs.length > 200 && (
                <p className="text-xs text-muted-foreground pt-2">
                  Mostrando 200 de {txs.length}. Exporta para ver todas.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MarginCard({
  title,
  icon,
  buckets,
  labelFor,
  fmtMargin,
}: {
  title: string;
  icon: React.ReactNode;
  buckets: MarginBucket[];
  labelFor: (b: MarginBucket) => string;
  fmtMargin: (b: MarginBucket) => string;
}) {
  const visible = buckets.filter((b) => b.count > 0).slice(0, 10);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="space-y-1">
            {visible.map((b) => (
              <div key={b.key} className="flex items-center justify-between border rounded-md px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="font-medium truncate">{labelFor(b)}</div>
                  <div className="text-[10px] text-muted-foreground flex gap-1 flex-wrap">
                    <span>{b.count} ops</span>
                    {b.invoiced > 0 && <Badge variant="secondary" className="h-4 px-1 text-[9px]">FE {b.invoiced}</Badge>}
                    {b.pending > 0 && <Badge variant="outline" className="h-4 px-1 text-[9px]">Pend {b.pending}</Badge>}
                    {b.failed > 0 && <Badge variant="destructive" className="h-4 px-1 text-[9px]">Err {b.failed}</Badge>}
                  </div>
                </div>
                <div className="tabular-nums text-emerald-600 font-semibold whitespace-nowrap">
                  {fmtMargin(b)}
                </div>
              </div>
            ))}
            {buckets.length > visible.length && (
              <p className="text-[10px] text-muted-foreground pt-1">
                Mostrando 10 de {buckets.length}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
