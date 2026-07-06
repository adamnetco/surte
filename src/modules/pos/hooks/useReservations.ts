// Ola 28 Slice 1 — Hook de reservas (agenda del día + disponibilidad + CRUD).
// Refactor Fase 2: delegado a `supabaseReservationsRepository` — el hook ya no
// habla directo con Supabase, sólo orquesta React Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { supabaseReservationsRepository } from "@/infrastructure/database/SupabaseReservationsRepository";
import type {
  AvailableTable,
  DepositStatus,
  FloorArea,
  FloorTable,
  ReservationDraft,
  ReservationRow,
  ReservationSource,
  ReservationStatus,
} from "@/core/ports/IReservationsRepository";

export type {
  AvailableTable,
  DepositStatus,
  FloorArea,
  FloorTable,
  ReservationDraft,
  ReservationRow,
  ReservationSource,
  ReservationStatus,
};

export function useReservationsAgenda(day: string, locationId?: string | null) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["reservations-agenda", currentOrg?.id, day, locationId ?? null],
    enabled: !!currentOrg?.id,
    queryFn: () =>
      supabaseReservationsRepository.getDayAgenda(
        currentOrg!.id,
        day,
        locationId ?? null,
      ),
  });
}

export function useCheckAvailability() {
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: (args: {
      starts_at: string;
      ends_at: string;
      party_size: number;
      location_id?: string | null;
      exclude_reservation_id?: string | null;
    }) => supabaseReservationsRepository.checkAvailability(currentOrg!.id, args),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: (draft: ReservationDraft) =>
      supabaseReservationsRepository.create(currentOrg!.id, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations-agenda"] }),
  });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: ReservationStatus; cancel_reason?: string }) =>
      supabaseReservationsRepository.updateStatus(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations-agenda"] }),
  });
}

// Ola 28 Slice 2 — Asignar/quitar mesa (drag&drop sobre el plano).
export function useAssignReservationTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; dining_table_id: string | null }) =>
      supabaseReservationsRepository.assignTable(args.id, args.dining_table_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations-agenda"] }),
  });
}

// Ola 28 Slice 2 — Mesas + áreas (posiciones del plano) para la vista FloorMap.
export function useFloorMap() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["floor-map", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: () => supabaseReservationsRepository.getFloorMap(currentOrg!.id),
  });
}
