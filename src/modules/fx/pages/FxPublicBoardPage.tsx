import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Radio } from "lucide-react";
import { useFxCurrencies, useFxPairs, useFxLatestRates } from "../hooks/useFx";

export default function FxPublicBoardPage() {
  const { data: currencies = [] } = useFxCurrencies();
  const { data: pairs = [] } = useFxPairs();
  const { data: latest = {} } = useFxLatestRates();

  const currMap = useMemo(() => Object.fromEntries(currencies.map((c) => [c.id, c])), [currencies]);
  const activePairs = pairs.filter((p) => p.is_active);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <Radio className="h-7 w-7 text-emerald-400" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cotizaciones del día</h1>
            <p className="text-sm text-white/60">Actualizado {new Date().toLocaleString("es-CO")}</p>
          </div>
        </div>
        <div className="text-xs text-white/40">SistecPOS · Casas de Cambio</div>
      </header>

      <main className="flex-1 p-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
        {activePairs.length === 0 && (
          <div className="col-span-full text-center text-white/60 py-20">
            No hay pares activos.
          </div>
        )}
        {activePairs.map((p) => {
          const rate = latest[p.id];
          const base = currMap[p.base_currency_id];
          const quote = currMap[p.quote_currency_id];
          return (
            <Card key={p.id} className="bg-slate-900 border-white/10 text-white">
              <CardContent className="p-6">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold">
                    {base?.code}<span className="text-white/40">/</span>{quote?.code}
                  </div>
                  {rate?.source && (
                    <span className="text-[10px] uppercase tracking-wider text-white/40">{rate.source}</span>
                  )}
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-emerald-400/80 uppercase tracking-wide">Compra</div>
                    <div className="text-3xl font-mono font-semibold text-emerald-400">
                      {rate ? Number(rate.buy_rate).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-rose-400/80 uppercase tracking-wide">Venta</div>
                    <div className="text-3xl font-mono font-semibold text-rose-400">
                      {rate ? Number(rate.sell_rate).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
                {rate?.effective_at && (
                  <div className="mt-4 text-[11px] text-white/40">
                    Vigente desde {new Date(rate.effective_at).toLocaleString("es-CO")}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
