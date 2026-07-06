/**
 * SupabaseReservationsRepository — Adaptador Supabase para IReservationsRepository.
 * Encapsula RPCs `reservation_day_agenda`, `reservation_check_availability`,
 * y tablas `reservations` / `dining_areas` / `dining_tables`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AvailableTable,
  CheckAvailabilityArgs,
  FloorArea,
  FloorTable,
  IReservationsRepository,
  ReservationDraft,
  ReservationRow,
  UpdateReservationStatusArgs,
} from "@/core/ports/IReservationsRepository";

const asAny = supabase as any;

export const supabaseReservationsRepository: IReservationsRepository = {
  async getDayAgenda(organizationId, day, locationId) {
    const { data, error } = await asAny.rpc("reservation_day_agenda", {
      _org_id: organizationId,
      _day: day,
      _location_id: locationId ?? null,
    });
    if (error) throw error;
    return (data ?? []) as ReservationRow[];
  },

  async checkAvailability(organizationId, args: CheckAvailabilityArgs) {
    const { data, error } = await asAny.rpc("reservation_check_availability", {
      _org_id: organizationId,
      _starts_at: args.starts_at,
      _ends_at: args.ends_at,
      _party_size: args.party_size,
      _location_id: args.location_id ?? null,
      _exclude_reservation_id: args.exclude_reservation_id ?? null,
    });
    if (error) throw error;
    return (data ?? []) as AvailableTable[];
  },

  async create(organizationId, draft: ReservationDraft) {
    const payload = {
      organization_id: organizationId,
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
    const { data, error } = await asAny
      .from("reservations")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(args: UpdateReservationStatusArgs) {
    const patch: Record<string, any> = { status: args.status };
    if (args.status === "seated") patch.seated_at = new Date().toISOString();
    if (args.status === "completed") patch.completed_at = new Date().toISOString();
    if (args.status === "cancelled") {
      patch.cancelled_at = new Date().toISOString();
      patch.cancel_reason = args.cancel_reason ?? null;
    }
    const { error } = await asAny.from("reservations").update(patch).eq("id", args.id);
    if (error) throw error;
  },

  async assignTable(id, diningTableId) {
    const { error } = await asAny
      .from("reservations")
      .update({ dining_table_id: diningTableId })
      .eq("id", id);
    if (error) throw error;
  },

  async getFloorMap(organizationId) {
    const [{ data: a }, { data: t }] = await Promise.all([
      asAny
        .from("dining_areas")
        .select("id,name,color")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order"),
      asAny
        .from("dining_tables")
        .select("id,label,capacity,pos_x,pos_y,width,height,shape,dining_area_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("label"),
    ]);
    return {
      areas: (a ?? []) as FloorArea[],
      tables: (t ?? []) as FloorTable[],
    };
  },
};
