// Ola 28 Slice 1 — Hook de reservas (agenda del día + disponibilidad + CRUD).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

export type ReservationStatus = "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
export type ReservationSource = "walkin" | "phone" | "whatsapp" | "web" | "admin";
export type DepositStatus = "none" | "pending" | "paid" | "refunded" | "forfeited";

export interface ReservationRow {
  id: string;
  dining_table_id: string | null;
  table_label: string | null;
  customer_name: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  source: ReservationSource;
  deposit_status: DepositStatus;
  deposit_amount: number;
}

export interface AvailableTable {
  dining_table_id: string;
  label: string;
  capacity: number;
  dining_area_id: string | null;
  area_name: string | null;
}

export function useReservationsAgenda(day: string, locationId?: string | null) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["reservations-agenda", currentOrg?.id, day, locationId ?? null],
    enabled: !!currentOrg?.id,
    queryFn: async (): Promise<ReservationRow[]> => {
      const { data, error } = await supabase.rpc("reservation_day_agenda" as any, {
        _org_id: currentOrg!.id,
        _day: day,
        _location_id: locationId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as ReservationRow[];
    },
  });
}

export function useCheckAvailability() {
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (args: {
      starts_at: string;
      ends_at: string;
      party_size: number;
      location_id?: string | null;
      exclude_reservation_id?: string | null;
    }): Promise<AvailableTable[]> => {
      const { data, error } = await supabase.rpc("reservation_check_availability" as any, {
        _org_id: currentOrg!.id,
        _starts_at: args.starts_at,
        _ends_at: args.ends_at,
        _party_size: args.party_size,
        _location_id: args.location_id ?? null,
        _exclude_reservation_id: args.exclude_reservation_id ?? null,
      });
      if (error) throw error;
      return (data ?? []) as AvailableTable[];
    },
  });
}

export interface ReservationDraft {
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dining_table_id?: string | null;
  source?: ReservationSource;
  deposit_amount?: number;
  notes?: string | null;
  location_id?: string | null;
}

export function useCreateReservation() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (draft: ReservationDraft) => {
      const payload = {
        organization_id: currentOrg!.id,
        customer_name: draft.customer_name,
        customer_phone: draft.customer_phone ?? null,
        customer_email: draft.customer_email ?? null,
        party_size: draft.party_size,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
        dining_table_id: draft.dining_table_id ?? null,
        source: draft.source ?? "admin",
        deposit_amount: draft.deposit_amount ?? 0,
        deposit_status: (draft.deposit_amount ?? 0) > 0 ? "pending" : "none",
        notes: draft.notes ?? null,
        location_id: draft.location_id ?? null,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("reservations" as any).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations-agenda"] }),
  });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status: ReservationStatus; cancel_reason?: string }) => {
      const patch: Record<string, any> = { status: args.status };
      if (args.status === "seated") patch.seated_at = new Date().toISOString();
      if (args.status === "completed") patch.completed_at = new Date().toISOString();
      if (args.status === "cancelled") {
        patch.cancelled_at = new Date().toISOString();
        patch.cancel_reason = args.cancel_reason ?? null;
      }
      const { error } = await supabase.from("reservations" as any).update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations-agenda"] }),
  });
}
