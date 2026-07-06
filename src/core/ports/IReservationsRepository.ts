/**
 * IReservationsRepository — Contrato para la agenda de reservas y el plano
 * de mesas asociado. Aísla `reservations`, `dining_areas` y `dining_tables`
 * de la capa de presentación.
 */
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";
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

export interface CheckAvailabilityArgs {
  starts_at: string;
  ends_at: string;
  party_size: number;
  location_id?: string | null;
  exclude_reservation_id?: string | null;
}

export interface UpdateReservationStatusArgs {
  id: string;
  status: ReservationStatus;
  cancel_reason?: string;
}

export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  shape: string;
  dining_area_id: string | null;
}
export interface FloorArea {
  id: string;
  name: string;
  color: string | null;
}

export interface IReservationsRepository {
  getDayAgenda(
    organizationId: string,
    day: string,
    locationId: string | null,
  ): Promise<ReservationRow[]>;

  checkAvailability(
    organizationId: string,
    args: CheckAvailabilityArgs,
  ): Promise<AvailableTable[]>;

  create(organizationId: string, draft: ReservationDraft): Promise<unknown>;

  updateStatus(args: UpdateReservationStatusArgs): Promise<void>;

  assignTable(id: string, diningTableId: string | null): Promise<void>;

  getFloorMap(
    organizationId: string,
  ): Promise<{ areas: FloorArea[]; tables: FloorTable[] }>;
}
