/**
 * Tenant Data Island — Aislamiento estricto de export/import por tienda.
 *
 * Diseño:
 * - Cada tabla declarada aquí tiene una columna `organization_id`.
 * - Export: descarga ZIP con CSVs filtrados estrictamente por `organization_id`.
 *   El nombre del archivo incluye slug + fecha → trazabilidad.
 * - Import: ANTES de insertar/upsert, fuerza `organization_id = currentOrgId`
 *   en cada fila. Cualquier valor traído en el CSV se sobrescribe → previene
 *   contaminación cruzada entre tiendas.
 */
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { jsonToCsv } from "@/modules/admin-cms/lib/csvUtils";

export interface IslandTable {
  name: string;          // identificador (filename y key)
  label: string;
  table: string;         // tabla real en DB
  orderBy?: { column: string; ascending: boolean };
  skipOnImport?: string[];
}

/**
 * Curado de tablas "isla" — todas tienen columna organization_id confirmada.
 * Orden importa para import (deps básicas primero).
 */
export const ISLAND_TABLES: IslandTable[] = [
  { name: "categories",            label: "Categorías",        table: "categories",            orderBy: { column: "sort_order", ascending: true }, skipOnImport: ["created_at", "updated_at"] },
  { name: "brands",                label: "Marcas",            table: "brands",                orderBy: { column: "sort_order", ascending: true }, skipOnImport: ["created_at"] },
  { name: "products",              label: "Productos",         table: "products",              orderBy: { column: "name", ascending: true },       skipOnImport: ["created_at", "updated_at"] },
  { name: "product_presentations", label: "Presentaciones",    table: "product_presentations", orderBy: { column: "sort_order", ascending: true }, skipOnImport: ["created_at", "updated_at"] },
  { name: "product_media",         label: "Media de productos",table: "product_media",         orderBy: { column: "sort_order", ascending: true }, skipOnImport: ["created_at"] },
  { name: "modifier_groups",       label: "Grupos modificadores", table: "modifier_groups",    orderBy: { column: "sort_order", ascending: true }, skipOnImport: ["created_at", "updated_at"] },
  { name: "modifier_options",      label: "Opciones modificadoras", table: "modifier_options", orderBy: { column: "sort_order", ascending: true }, skipOnImport: ["created_at", "updated_at"] },
  { name: "coupons",               label: "Cupones",           table: "coupons",               orderBy: { column: "code", ascending: true },       skipOnImport: ["created_at", "updated_at"] },
  { name: "warehouses",            label: "Bodegas",           table: "warehouses",            skipOnImport: ["created_at", "updated_at"] },
  { name: "suppliers",             label: "Proveedores",       table: "suppliers",             skipOnImport: ["created_at", "updated_at"] },
  { name: "dining_areas",          label: "Áreas (mesas)",     table: "dining_areas",          skipOnImport: ["created_at", "updated_at"] },
  { name: "dining_tables",         label: "Mesas",             table: "dining_tables",         skipOnImport: ["created_at", "updated_at"] },
];

const PAGE_SIZE = 1000;

/** Trae TODAS las filas de una tabla filtradas por organization_id (paginado). */
export async function fetchIslandRows(table: IslandTable, orgId: string): Promise<Record<string, any>[]> {
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = (supabase as any).from(table.table).select("*").eq("organization_id", orgId);
    if (table.orderBy) q = q.order(table.orderBy.column, { ascending: table.orderBy.ascending });
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table.label}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * Fuerza organization_id = orgId en cada fila e ignora skipOnImport.
 * Cualquier organization_id existente en el CSV es sobrescrito → aislamiento estricto.
 */
export function forceOrgOnRows<T extends Record<string, any>>(
  rows: T[],
  orgId: string,
  skipOnImport: string[] = [],
): Record<string, any>[] {
  if (!orgId) throw new Error("forceOrgOnRows: orgId requerido");
  return rows.map((row) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (skipOnImport.includes(k)) continue;
      if (k === "id" && (v === null || v === undefined || String(v).trim() === "")) continue;
      out[k] = v;
    }
    out.organization_id = orgId; // siempre al final → no se puede sobrescribir
    return out;
  });
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  summary: { table: string; rows: number }[];
}

/** Empaqueta todas las tablas isla en un ZIP con CSVs. */
export async function exportTenantIsland(orgId: string, slug: string): Promise<ExportResult> {
  if (!orgId) throw new Error("orgId requerido");
  const zip = new JSZip();
  const summary: { table: string; rows: number }[] = [];

  // Manifiesto
  const manifest = {
    slug,
    organization_id: orgId,
    exported_at: new Date().toISOString(),
    tables: ISLAND_TABLES.map((t) => t.name),
    version: 1,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  for (const t of ISLAND_TABLES) {
    const rows = await fetchIslandRows(t, orgId);
    summary.push({ table: t.name, rows: rows.length });
    if (rows.length === 0) {
      zip.file(`${t.name}.csv`, ""); // archivo vacío para señalizar tabla
    } else {
      zip.file(`${t.name}.csv`, "\uFEFF" + jsonToCsv(rows));
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-island-${date}.zip`;
  return { blob, filename, summary };
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
