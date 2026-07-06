/**
 * IPosVoidRepository — contrato para emitir un vale fiscal de anulación
 * sobre un ítem de una orden en mesa (RPC `pos_void_table_item`).
 *
 * Fase 2 · Hexagonal. Consumido por VoidItemDialog.
 */
import type { VoidReasonCode } from "@/modules/pos/components/VoidItemDialog";

export interface VoidTableItemResult {
  ticket: number | string | null;
  fiscal_hash: string | null;
}

export interface IPosVoidRepository {
  voidTableItem(args: {
    itemId: string;
    reasonCode: VoidReasonCode;
    reasonText: string;
  }): Promise<VoidTableItemResult>;
}
