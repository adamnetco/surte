import { useEffect, useState } from "react";
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

export default function CloseSessionDialog({ open, onOpenChange, sessionId, openingAmount, organizationId, userId, onClosed }: Props) {
  const [totals, setTotals] = useState<Totals>({ cash: 0, card: 0, transfer: 0, other: 0, total: 0, count: 0 });
  const [counted, setCounted] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: pays } = await supabase
        .from("pos_payments")
        .select("method,amount")
        .eq("cash_session_id", sessionId);
      const { count } = await supabase
        .from("pos_orders")
        .select("id", { count: "exact", head: true })
        .eq("cash_session_id", sessionId)
        .eq("status", "paid");

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
      setCounted(String(openingAmount + t.cash));
    })();
  }, [open, sessionId, openingAmount]);

  const expected = openingAmount + totals.cash;
  const diff = (Number(counted) || 0) - expected;

  const close = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("cash_sessions")
      .update({
        status: "closed",
        closed_by: userId,
        closed_at: new Date().toISOString(),
        expected_amount: expected,
        closing_amount: Number(counted) || 0,
        difference: diff,
        total_sales: totals.total,
        total_cash: totals.cash,
        total_card: totals.card,
        total_transfer: totals.transfer,
        total_other: totals.other,
        ticket_count: totals.count,
        notes,
      })
      .eq("id", sessionId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onOpenChange(false);
    onClosed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cierre Z — Arqueo de caja</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <Row label="Tickets" value={String(totals.count)} />
            <Row label="Base inicial" value={COP(openingAmount)} />
            <Row label="Efectivo" value={COP(totals.cash)} />
            <Row label="Tarjeta" value={COP(totals.card)} />
            <Row label="Transferencia/Wallets" value={COP(totals.transfer)} />
            <Row label="Otros" value={COP(totals.other)} />
            <hr className="my-1" />
            <Row label="Ventas totales" value={COP(totals.total)} bold />
            <Row label="Efectivo esperado" value={COP(expected)} bold />
          </div>
          <div className="space-y-1">
            <Label>Efectivo contado</Label>
            <Input type="number" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value)} />
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
