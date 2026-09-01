/**
 * Puerto: conversión de inventario entre presentaciones (desempacar / reagrupar).
 * La UI nunca habla con Supabase directamente.
 */

export interface ConversionRule {
  id: string;
  name: string;
  from_product_id: string;
  from_presentation_id: string | null;
  to_product_id: string;
  to_presentation_id: string | null;
  factor: number;
  is_active: boolean;
}

export interface ConversionRuleInput {
  name: string;
  from_product_id: string;
  from_presentation_id: string | null;
  to_product_id: string;
  to_presentation_id: string | null;
  factor: number;
}

export interface ConversionLogEntry {
  id: string;
  warehouse_id: string;
  from_product_id: string;
  to_product_id: string;
  qty_from: number;
  factor: number;
  qty_to: number;
  unit_cost_to: number | null;
  notes: string | null;
  created_at: string;
}

export interface ExecuteConversionInput {
  warehouseId: string;
  fromProductId: string;
  fromPresentationId: string | null;
  toProductId: string;
  toPresentationId: string | null;
  qty: number;
  factor: number;
  notes?: string | null;
  ruleId?: string | null;
}

export interface ExecuteConversionResult {
  conversionId: string;
  qtyFrom: number;
  qtyTo: number;
  unitCostTo: number;
}

export interface IInventoryConversionRepository {
  listRules(orgId: string): Promise<ConversionRule[]>;
  saveRule(orgId: string, input: ConversionRuleInput, id?: string): Promise<void>;
  deleteRule(orgId: string, id: string): Promise<void>;
  listHistory(orgId: string, warehouseId?: string, limit?: number): Promise<ConversionLogEntry[]>;
  execute(orgId: string, input: ExecuteConversionInput): Promise<ExecuteConversionResult>;
}
