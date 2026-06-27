import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Granularity = "hour" | "day" | "week" | "month";

export interface SalesBucket {
  bucket: string;
  gross: number;
  net: number;
  tax: number;
  discount: number;
  refunds: number;
  tickets: number;
  units: number;
}

export interface TopProduct {
  product_id: string | null;
  product_name: string;
  sku: string | null;
  units: number;
  gross: number;
  tickets: number;
}

export interface PaymentSlice {
  method: string;
  amount: number;
  count: number;
}

export interface CashierRow {
  cashier_id: string | null;
  cashier_name: string;
  tickets: number;
  gross: number;
  avg_ticket: number;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

interface Params {
  orgId?: string | null;
  from: Date;
  to: Date;
  granularity: Granularity;
}

export function useSalesSummary({ orgId, from, to, granularity }: Params) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["report-sales-summary", orgId, from.toISOString(), to.toISOString(), granularity],
    queryFn: async (): Promise<SalesBucket[]> => {
      const { data, error } = await (supabase as any).rpc("report_sales_summary", {
        _org_id: orgId,
        _from: from.toISOString(),
        _to: to.toISOString(),
        _granularity: granularity,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        bucket: r.bucket,
        gross: num(r.gross),
        net: num(r.net),
        tax: num(r.tax),
        discount: num(r.discount),
        refunds: num(r.refunds),
        tickets: num(r.tickets),
        units: num(r.units),
      }));
    },
    staleTime: 60_000,
  });
}

export function useTopProducts({ orgId, from, to, limit = 10 }: Omit<Params, "granularity"> & { limit?: number }) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["report-top-products", orgId, from.toISOString(), to.toISOString(), limit],
    queryFn: async (): Promise<TopProduct[]> => {
      const { data, error } = await (supabase as any).rpc("report_top_products", {
        _org_id: orgId,
        _from: from.toISOString(),
        _to: to.toISOString(),
        _limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        product_id: r.product_id,
        product_name: r.product_name ?? "Sin nombre",
        sku: r.sku,
        units: num(r.units),
        gross: num(r.gross),
        tickets: num(r.tickets),
      }));
    },
    staleTime: 60_000,
  });
}

export function usePaymentMix({ orgId, from, to }: Omit<Params, "granularity">) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["report-payment-mix", orgId, from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<PaymentSlice[]> => {
      const { data, error } = await (supabase as any).rpc("report_payment_mix", {
        _org_id: orgId,
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        method: r.method,
        amount: num(r.amount),
        count: num(r.count),
      }));
    },
    staleTime: 60_000,
  });
}

export function useCashierPerformance({ orgId, from, to }: Omit<Params, "granularity">) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["report-cashier", orgId, from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<CashierRow[]> => {
      const { data, error } = await (supabase as any).rpc("report_cashier_performance", {
        _org_id: orgId,
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        cashier_id: r.cashier_id,
        cashier_name: r.cashier_name ?? "Cajero",
        tickets: num(r.tickets),
        gross: num(r.gross),
        avg_ticket: num(r.avg_ticket),
      }));
    },
    staleTime: 60_000,
  });
}

export interface LocationRow {
  location_id: string | null;
  location_name: string;
  tickets: number;
  gross: number;
  net: number;
  tax: number;
  discount: number;
  refunds: number;
  avg_ticket: number;
}

export function useSalesByLocation({ orgId, from, to }: Omit<Params, "granularity">) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["report-sales-by-location", orgId, from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<LocationRow[]> => {
      const { data, error } = await (supabase as any).rpc("report_sales_by_location", {
        _org_id: orgId,
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        location_id: r.location_id,
        location_name: r.location_name ?? "Sin sucursal",
        tickets: num(r.tickets),
        gross: num(r.gross),
        net: num(r.net),
        tax: num(r.tax),
        discount: num(r.discount),
        refunds: num(r.refunds),
        avg_ticket: num(r.avg_ticket),
      }));
    },
    staleTime: 60_000,
  });
}

export function aggregate(buckets: SalesBucket[]) {
  return buckets.reduce(
    (acc, b) => ({
      gross: acc.gross + b.gross,
      net: acc.net + b.net,
      tax: acc.tax + b.tax,
      discount: acc.discount + b.discount,
      refunds: acc.refunds + b.refunds,
      tickets: acc.tickets + b.tickets,
      units: acc.units + b.units,
    }),
    { gross: 0, net: 0, tax: 0, discount: 0, refunds: 0, tickets: 0, units: 0 },
  );
}
