import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, CreditCard } from "lucide-react";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";

interface PaymentRow {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
}

export default function ClientBillingTab() {
  const { user } = useAuth();
  const { buildUrl } = useWhatsAppConfig();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: licenses } = await supabase
        .from("licenses").select("id").eq("contact_email", user!.email ?? "");
      const ids = (licenses || []).map((l: any) => l.id);
      if (ids.length === 0) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from("payments")
        .select("id, amount, status, paid_at, created_at, payment_method, reference, notes")
        .in("license_id", ids)
        .order("created_at", { ascending: false }).limit(50);
      setPayments(data ?? []);
      setLoading(false);
    }
    load();
  }, [user]);

  function handlePayNow(paymentId: string, amount: number) {
    const msg = `Hola, quiero realizar el pago pendiente de $${amount.toLocaleString("es-CO")} COP (Ref: ${paymentId.slice(0, 8)}). Mi correo es ${user?.email}`;
    window.open(buildUrl(msg), "_blank");
  }

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    paid: { label: "Pagado", variant: "default" },
    pending: { label: "Pendiente", variant: "secondary" },
    overdue: { label: "Vencido", variant: "destructive" },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Historial de Facturación</h3>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay registros de facturación.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {payments.map((p) => {
              const st = statusMap[p.status] ?? statusMap.pending;
              const date = p.paid_at || p.created_at;
              return (
                <Card key={p.id}>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "short" })}
                      </span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <p className="text-lg font-bold">${p.amount.toLocaleString("es-CO")} COP</p>
                    {p.payment_method && <p className="text-xs text-muted-foreground capitalize">{p.payment_method}</p>}
                    {p.status === "pending" && (
                      <Button size="sm" className="w-full mt-2" onClick={() => handlePayNow(p.id, p.amount)}>Pagar Ahora</Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead><TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead><TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const st = statusMap[p.status] ?? statusMap.pending;
                  const date = p.paid_at || p.created_at;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "long" })}</TableCell>
                      <TableCell className="font-medium">${p.amount.toLocaleString("es-CO")}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{p.payment_method ?? "—"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending"
                          ? <Button size="sm" onClick={() => handlePayNow(p.id, p.amount)}>Pagar Ahora</Button>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
