import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  openingAmount: number;
  organizationId: string;
  userId: string;
  onClosed: () => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

interface Totals {
  cash: number; card: number; transfer: number; other: number; total: number; count: number;
}

interface Denomination {
  id: string;
  value: number;
  kind: string;
}

export default function CloseSessionDialog({ open, onOpenChange, sessionId, openingAmount, organizationId, userId, onClosed }: Props) {
  const [totals, setTotals] = useState<Totals>({ cash: 0, card: 0, transfer: 0, other: 0, total: 0, count: 0 });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: pays }, { count }, { data: dens }] = await Promise.all([
        supabase.from("pos_payments").select("method,amount").eq("cash_session_id", sessionId),
        supabase.from("pos_orders").select("id", { count: "exact", head: true }).eq("cash_session_id", sessionId).eq("status", "paid"),
        supabase.from("cash_denominations").select("id,value,kind,label").eq("currency", "COP").eq("is_active", true).order("value", { ascending: false }),
      ]);

      const t: Totals = { cash: 0, card: 0, transfer: 0, other: 0, total: 0, count: count ?? 0 };
      (pays ?? []).forEach((p: any) => {
        const a = Number(p.amount);
        t.total += a;
        if (p.method === "efectivo") t.cash += a;
        else if (p.method?.startsWith("tarjeta")) t.card += a;
        else if (["transferencia", "nequi", "daviplata"].includes(p.method)) t.transfer += a;
        else t.other += a;
      });
      setTotals(t);
      setDenoms((dens ?? []) as Denomination[]);
      setCounts({});
    })();
  }, [open, sessionId]);

  const expected = openingAmount + totals.cash;
  const countedTotal = useMemo(
    () => denoms.reduce((acc, d) => acc + Number(d.value) * (parseInt(counts[d.id] || "0", 10) || 0), 0),
    [denoms, counts]
  );
  const diff = countedTotal - expected;

  const close = async () => {
    setBusy(true);
    const payload = denoms
      .map((d) => ({ denomination_id: d.id, quantity: parseInt(counts[d.id] || "0", 10) || 0 }))
      .filter((x) => x.quantity > 0);

    // Save expected first so RPC can compute difference correctly
    await supabase
      .from("cash_sessions")
      .update({
        expected_amount: expected,
        total_sales: totals.total,
        total_cash: totals.cash,
        total_card: totals.card,
        total_transfer: totals.transfer,
        total_other: totals.other,
        ticket_count: totals.count,
        notes,
      })
      .eq("id", sessionId);

    const { error } = await supabase.rpc("close_cash_session_with_counts", {
      _session_id: sessionId,
      _counts: payload as any,
    });

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Caja cerrada");
    onOpenChange(false);
    onClosed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cierre Z — Arqueo con denominaciones</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <Row label="Tickets" value={String(totals.count)} />
            <Row label="Base inicial" value={COP(openingAmount)} />
            <Row label="Efectivo (ventas)" value={COP(totals.cash)} />
            <Row label="Tarjeta" value={COP(totals.card)} />
            <Row label="Transferencia/Wallets" value={COP(totals.transfer)} />
            <Row label="Otros" value={COP(totals.other)} />
            <hr className="my-1" />
            <Row label="Ventas totales" value={COP(totals.total)} bold />
            <Row label="Efectivo esperado" value={COP(expected)} bold />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Conteo por denominación</Label>
            <div className="grid grid-cols-1 gap-1 border rounded-lg p-2">
              {denoms.map((d) => {
                const q = parseInt(counts[d.id] || "0", 10) || 0;
                const sub = q * Number(d.value);
                return (
                  <div key={d.id} className="grid grid-cols-[1fr_80px_110px] items-center gap-2">
                    <span className="text-muted-foreground">
                      {d.kind === "coin" ? "🪙" : "💵"} {d.label || COP(Number(d.value))}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="h-9"
                      value={counts[d.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => setCounts((c) => ({ ...c, [d.id]: e.target.value }))}
                    />
                    <span className="text-right tabular-nums">{COP(sub)}</span>
                  </div>
                );
              })}
              {!denoms.length && (
                <div className="text-muted-foreground text-xs p-2">No hay denominaciones configuradas.</div>
              )}
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg p-3">
            <Row label="Efectivo contado" value={COP(countedTotal)} bold />
          </div>

          <div className={`rounded-lg p-2 text-center font-semibold ${diff === 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            Diferencia: {COP(diff)}
          </div>

          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button className="w-full h-11" onClick={close} disabled={busy}>
            {busy ? "Cerrando..." : "Cerrar caja"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span>{value}</span>
    </div>
  );
}
