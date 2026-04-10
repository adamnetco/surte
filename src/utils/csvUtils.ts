/**
 * CSV Export / Import utilities for SURTÉ YA admin data management.
 * Restricted to superadmin usage only.
 */

// ── Export helpers ──────────────────────────────────────────────

export function jsonToCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export function downloadCsv(csv: string, filename: string) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import helpers ──────────────────────────────────────────────

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = values[i]?.trim() ?? "";
    });
    return row;
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ── Table definitions for export/import ─────────────────────────

export interface TableDef {
  name: string;
  label: string;
  table: string;
  /** columns to export (null = all) */
  columns?: string[];
  /** columns to exclude from import (auto-generated) */
  skipOnImport?: string[];
  orderBy?: { column: string; ascending: boolean };
}

export const EXPORTABLE_TABLES: TableDef[] = [
  {
    name: "products",
    label: "Productos",
    table: "products",
    orderBy: { column: "name", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "categories",
    label: "Categorías",
    table: "categories",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "brands",
    label: "Marcas",
    table: "brands",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at"],
  },
  {
    name: "orders",
    label: "Pedidos",
    table: "orders",
    orderBy: { column: "created_at", ascending: false },
    skipOnImport: ["created_at", "updated_at", "order_number"],
  },
  {
    name: "order_items",
    label: "Items de Pedidos",
    table: "order_items",
    skipOnImport: [],
  },
  {
    name: "profiles",
    label: "Perfiles",
    table: "profiles",
    orderBy: { column: "created_at", ascending: false },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "hero_slides",
    label: "Hero Slides",
    table: "hero_slides",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "banners",
    label: "Banners",
    table: "banners",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "shipping_zones",
    label: "Zonas de Envío",
    table: "shipping_zones",
    orderBy: { column: "city", ascending: true },
    skipOnImport: ["created_at"],
  },
  {
    name: "municipality_settings",
    label: "Ciudades",
    table: "municipality_settings",
    orderBy: { column: "city", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "app_settings",
    label: "Configuración",
    table: "app_settings",
    orderBy: { column: "key", ascending: true },
    skipOnImport: ["updated_at"],
  },
  {
    name: "featured_sections",
    label: "Secciones Destacadas",
    table: "featured_sections",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "testimonials",
    label: "Testimonios",
    table: "testimonials",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at"],
  },
  {
    name: "google_reviews",
    label: "Google Reviews",
    table: "google_reviews",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at"],
  },
  {
    name: "gallery",
    label: "Galería",
    table: "gallery",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at"],
  },
  {
    name: "coupons",
    label: "Cupones",
    table: "coupons",
    orderBy: { column: "code", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "landing_pages",
    label: "Landing Pages",
    table: "landing_pages",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "landing_page_products",
    label: "Landing Page Productos",
    table: "landing_page_products",
    skipOnImport: ["created_at"],
  },
  {
    name: "product_presentations",
    label: "Presentaciones",
    table: "product_presentations",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "product_media",
    label: "Media de Productos",
    table: "product_media",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at"],
  },
  {
    name: "custom_scripts",
    label: "Scripts Personalizados",
    table: "custom_scripts",
    orderBy: { column: "sort_order", ascending: true },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "notification_subscriptions",
    label: "Suscripciones WhatsApp",
    table: "notification_subscriptions",
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "customer_reviews",
    label: "Reseñas de Clientes",
    table: "customer_reviews",
    orderBy: { column: "created_at", ascending: false },
    skipOnImport: ["created_at", "updated_at"],
  },
  {
    name: "user_roles",
    label: "Roles de Usuario",
    table: "user_roles",
    skipOnImport: [],
  },
];
