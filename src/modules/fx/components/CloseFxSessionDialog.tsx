import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Banknote, Coins } from "lucide-react";
import { useFxCurrencies } from "../hooks/useFx";
import {
  useActiveFxCashSession,
  useFxDenominations,
  useCloseFxSession,
} from "../hooks/useFxCashSession";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmt = (n: number, decimals = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-CO", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
    : "—";

/**
 * Cierre Z multi-divisa para casas de cambio.
 * Tabs por divisa activa → conteo por denominación → diferencia vs expected.
 */
export default function CloseFxSessionDialog({ open, onOpenChange }: Props) {
  const { data: currencies = [] } = useFxCurrencies();
  const { data: session, isLoading: loadingSession } = useActiveFxCashSession();
  const { data: denoms = [] } = useFxDenominations();
  const closeMut = useCloseFxSession();

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const activeCodes = useMemo(
    () => currencies.filter((c) => c.is_active).map((c) => c.code),
    [currencies]
  );

  // Garantiza que aparezcan todas las divisas con saldo + las activas
  const tabCodes = useMemo(() => {
    const set = new Set<string>(activeCodes);
    if (session?.balances) Object.keys(session.balances).forEach((k) => set.add(k));
    if (!set.size) set.add("COP");
    return Array.from(set);
  }, [activeCodes, session]);

  const denomsByCcy = useMemo(() => {
    const map: Record<string, typeof denoms> = {};
    denoms.forEach((d) => {
      (map[d.currency] ||= []).push(d);
    });
    return map;
  }, [denoms]);

  const countedByCcy = useMemo(() => {
    const totals: Record<string, number> = {};
    denoms.forEach((d) => {
      const q = parseInt(counts[d.id] || "0", 10) || 0;
      if (q > 0) totals[d.currency] = (totals[d.currency] ?? 0) + q * Number(d.value);
    });
    return totals;
  }, [counts, denoms]);

  const handleClose = async () => {
    if (!session?.id) return;
    const payload = denoms
      .map((d) => ({
        denomination_id: d.id,
        currency: d.currency,
        quantity: parseInt(counts[d.id] || "0", 10) || 0,
      }))
      .filter((x) => x.quantity > 0);

    await closeMut.mutateAsync({
      sessionId: session.id,
      counts: payload,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
    setCounts({});
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cierre de caja FX — Arqueo multi-divisa</DialogTitle>
        </DialogHeader>

        {loadingSession ? (
          <div className="py-10 grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !session ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No hay sesión de caja abierta.
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs defaultValue={tabCodes[0]} className="w-full">
              <TabsList className="w-full flex-wrap h-auto">
                {tabCodes.map((code) => (
                  <TabsTrigger key={code} value={code} className="flex-1 min-w-[80px]">
                    {code}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabCodes.map((code) => {
                const ccy = currencies.find((c) => c.code === code);
                const decimals = ccy?.decimals ?? 2;
                const list = denomsByCcy[code] ?? [];
                const bal = (session.balances?.[code] ?? {
                  opening: 0,
                  expected: 0,
                  counted: null,
                  diff: null,
                }) as { opening: number; expected: number; counted: number | null; diff: number | null };
                const counted = countedByCcy[code] ?? 0;
                const diff = counted - (bal.expected ?? 0);
                const diffStyle =
                  diff === 0
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                    : diff < 0
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30";

                return (
                  <TabsContent key={code} value={code} className="space-y-3">
                    <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                      <Row label="Apertura" value={fmt(bal.opening ?? 0, decimals)} />
                      <Row label="Esperado" value={fmt(bal.expected ?? 0, decimals)} bold />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-base">Conteo por denominación</Label>
                      {list.length ? (
                        <div className="border rounded-lg p-2 space-y-1">
                          {list.map((d) => {
                            const q = parseInt(counts[d.id] || "0", 10) || 0;
                            const sub = q * Number(d.value);
                            const Icon = d.kind === "coin" ? Coins : Banknote;
                            return (
                              <div
                                key={d.id}
                                className="grid grid-cols-[1fr_90px_120px] items-center gap-2 text-sm"
                              >
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <Icon className="w-3.5 h-3.5" />
                                  <span className="tabular-nums">{fmt(Number(d.value), decimals)}</span>
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  className="h-9"
                                  value={counts[d.id] ?? ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setCounts((c) => ({ ...c, [d.id]: e.target.value }))
                                  }
                                />
                                <span className="text-right tabular-nums">
                                  {fmt(sub, decimals)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs p-2 border rounded-lg">
                          Sin denominaciones configuradas para {code}. Configura en Admin → Caja.
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 text-sm">
                      <Row label="Contado" value={fmt(counted, decimals)} bold />
                    </div>

                    <div className={`rounded-lg p-3 text-center font-bold border ${diffStyle}`}>
                      {diff === 0
                        ? "Cuadrado"
                        : diff < 0
                          ? `Faltante ${fmt(Math.abs(diff), decimals)} ${code}`
                          : `Sobrante ${fmt(diff, decimals)} ${code}`}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>

            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones del arqueo…"
              />
            </div>

            <Button
              className="w-full h-11"
              onClick={handleClose}
              disabled={closeMut.isPending}
            >
              {closeMut.isPending ? "Cerrando..." : "Cerrar caja FX"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
