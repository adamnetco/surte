import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SmartAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description?: string;
  href?: string;
  count?: number;
  group: "stock" | "transfers" | "fx" | "einvoice" | "health" | "purchases" | "crm";
};

export function useSmartAlerts(orgId: string | undefined) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const out: SmartAlert[] = [];

    try {
      // 1) Stock crítico
      const { data: crit } = await supabase.rpc("inventory_critical_summary", { _org_id: orgId });
      const critCount = (crit ?? []).length;
      if (critCount > 0) {
        const severeCount = (crit ?? []).filter((r: any) => r.severity === "critical").length;
        out.push({
          id: "stock-critical",
          severity: severeCount > 0 ? "critical" : "warning",
          title: `${critCount} producto(s) bajo punto de reorden`,
          description: severeCount > 0 ? `${severeCount} en estado crítico` : "Revisa el reorden recomendado",
          href: "/admin/inventario",
          count: critCount,
          group: "stock",
        });
      }

      // 2) Traslados pendientes de recibir
      const { count: transfersPending } = await supabase
        .from("stock_transfers")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", orgId)
        .eq("status", "in_transit");
      if ((transfersPending ?? 0) > 0) {
        out.push({
          id: "transfers-in-transit",
          severity: "warning",
          title: `${transfersPending} traslado(s) en tránsito`,
          description: "Recibe o cancela desde Inventario",
          href: "/admin/inventario",
          count: transfersPending ?? 0,
          group: "transfers",
        });
      }

      // 3) Facturación electrónica con errores recientes (24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: einvErr } = await supabase
        .from("electronic_invoices")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", orgId)
        .in("status", ["error", "rejected"])
        .gte("created_at", since);
      if ((einvErr ?? 0) > 0) {
        out.push({
          id: "einvoice-errors",
          severity: "critical",
          title: `${einvErr} factura(s) electrónica(s) con error`,
          description: "Últimas 24 h — revisa y reintenta",
          href: "/admin?tab=overview",
          count: einvErr ?? 0,
          group: "einvoice",
        });
      }

      // 4) Comisiones FX pendientes de reintento
      const { count: fxRetry } = await supabase
        .from("fx_transactions")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", orgId)
        .eq("commission_invoice_status", "failed");
      if ((fxRetry ?? 0) > 0) {
        out.push({
          id: "fx-commission-retry",
          severity: "warning",
          title: `${fxRetry} comisión(es) FX pendientes`,
          description: "El reintento automático seguirá ejecutándose",
          href: "/admin/fx",
          count: fxRetry ?? 0,
          group: "fx",
        });
      }

      // 5) Health events recientes con status degraded/down
      const { data: health } = await supabase
        .from("health_events")
        .select("id, source, status, message, created_at")
        .eq("organization_id", orgId)
        .in("status", ["degraded", "down"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3);
      for (const h of (health ?? []) as Array<{ id: string; source: string | null; status: string | null; message: string | null }>) {
        out.push({
          id: `health-${h.id}`,
          severity: h.status === "down" ? "critical" : "warning",
          title: h.source ? `${h.source}: ${h.status}` : `Servicio ${h.status}`,
          description: h.message ?? undefined,
          href: "/superadmin/health",
          group: "health",
        });
      }

      // 6) Órdenes de compra vencidas (expected_at < hoy y no recibidas)
      const today = new Date().toISOString().slice(0, 10);
      const { data: overduePOs } = await supabase
        .from("purchase_orders")
        .select("id, po_code, po_number, expected_at, suppliers(name)")
        .eq("organization_id", orgId)
        .lt("expected_at", today)
        .in("status", ["draft", "sent", "partial"])
        .order("expected_at", { ascending: true })
        .limit(5);
      const overdueCount = (overduePOs ?? []).length;
      if (overdueCount > 0) {
        const oldest = overduePOs![0] as any;
        out.push({
          id: "purchases-overdue",
          severity: "warning",
          title: `${overdueCount} OC vencida(s)`,
          description: `La más antigua: ${oldest.po_code ?? oldest.po_number ?? oldest.id.slice(0,8)} de ${oldest.suppliers?.name ?? "—"}`,
          href: "/admin/compras",
          count: overdueCount,
          group: "purchases",
        });
      }

      // 7) OCs en estado "sent" pendientes de recibir > 7 días
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: stalePO } = await supabase
        .from("purchase_orders")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", orgId)
        .eq("status", "sent")
        .lt("created_at", weekAgo);
      if ((stalePO ?? 0) > 0) {
        out.push({
          id: "purchases-stale",
          severity: "info",
          title: `${stalePO} OC enviada(s) hace +7 días`,
          description: "Confirma entrega o reclama al proveedor",
          href: "/admin/compras",
          count: stalePO ?? 0,
          group: "purchases",
        });
      }
    } catch (e) {
      // Silencio: la campana sigue funcionando con lo que se haya podido cargar
    }

    out.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 } as const;
      return order[a.severity] - order[b.severity];
    });
    setAlerts(out);
    setLastFetch(Date.now());
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    fetchAlerts();
    const t = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(t);
  }, [orgId, fetchAlerts]);

  return { alerts, loading, refetch: fetchAlerts, lastFetch };
}
