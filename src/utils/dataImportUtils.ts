import type { TableDef } from "./csvUtils";

type ImportedRow = Record<string, unknown>;

export interface ImportPreviewAnalysis {
  rowsWithId: number;
  rowsWithoutId: number;
  blankIdRows: number;
}

const TRUE_VALUES = new Set(["true", "verdadero", "yes", "si", "sí", "1", "x"]);
const FALSE_VALUES = new Set(["false", "falso", "no", "0"]);
const STRICT_STRING_KEYS = new Set(["code", "order_number"]);
const NON_NUMERIC_KEY_PATTERNS = [/phone/i, /whatsapp/i, /gtin/i, /sku/i, /slug/i, /email/i, /token/i];

export const normalizeColumnName = (value: string) => value.replace(/^\uFEFF/, "").trim();

export const normalizeImportedHeaders = (rows: ImportedRow[]): ImportedRow[] => {
  return rows.map((row) =>
    Object.entries(row).reduce<ImportedRow>((acc, [key, value]) => {
      const normalizedKey = normalizeColumnName(key);
      if (!normalizedKey) return acc;
      acc[normalizedKey] = value;
      return acc;
    }, {}),
  );
};

export const analyzeImportRows = (rows: ImportedRow[]): ImportPreviewAnalysis => {
  return rows.reduce<ImportPreviewAnalysis>(
    (acc, row) => {
      const rawId = row.id;
      if (typeof rawId === "string") {
        if (rawId.trim()) {
          acc.rowsWithId += 1;
        } else {
          acc.blankIdRows += 1;
          acc.rowsWithoutId += 1;
        }
        return acc;
      }

      if (rawId) {
        acc.rowsWithId += 1;
      } else {
        acc.rowsWithoutId += 1;
      }
      return acc;
    },
    { rowsWithId: 0, rowsWithoutId: 0, blankIdRows: 0 },
  );
};

const shouldKeepAsString = (key: string) =>
  STRICT_STRING_KEYS.has(key) || NON_NUMERIC_KEY_PATTERNS.some((pattern) => pattern.test(key));

export const parseLocaleNumber = (value: string): number | null => {
  const normalized = value.trim().replace(/\s+/g, "");
  if (!normalized || !/^-?[\d.,]+$/.test(normalized)) return null;

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      const parsed = Number(normalized.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Number(normalized.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (normalized.includes(",")) {
    const parts = normalized.split(",");
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      const parsed = Number(`${parts[0].replace(/\./g, "")}.${parts[1]}`);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Number(normalized.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (normalized.includes(".")) {
    const parts = normalized.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      const parsed = Number(normalized.replace(/\./g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateValue = (key: string, value: Date) => {
  if (Number.isNaN(value.getTime())) return null;
  if (key.endsWith("_date")) {
    return value.toISOString().slice(0, 10);
  }
  return value.toISOString();
};

export const cleanImportedRows = (rows: ImportedRow[], def: TableDef): ImportedRow[] => {
  return rows.map((row) => {
    const cleaned: ImportedRow = {};

    for (const [rawKey, rawValue] of Object.entries(row)) {
      const key = normalizeColumnName(rawKey);
      if (!key || def.skipOnImport?.includes(key)) continue;
      if (key === "id" && (rawValue === null || rawValue === undefined || String(rawValue).trim() === "")) {
        continue;
      }

      if (rawValue instanceof Date) {
        cleaned[key] = normalizeDateValue(key, rawValue);
        continue;
      }

      if (typeof rawValue === "boolean" || typeof rawValue === "number") {
        cleaned[key] = rawValue;
        continue;
      }

      if (rawValue === null || rawValue === undefined) {
        cleaned[key] = null;
        continue;
      }

      const value = String(rawValue).trim();
      if (!value) {
        cleaned[key] = null;
        continue;
      }

      const lowered = value.toLowerCase();
      if (TRUE_VALUES.has(lowered)) {
        cleaned[key] = true;
        continue;
      }
      if (FALSE_VALUES.has(lowered)) {
        cleaned[key] = false;
        continue;
      }

      if (value.startsWith("[") || value.startsWith("{")) {
        try {
          cleaned[key] = JSON.parse(value);
          continue;
        } catch {
          cleaned[key] = value;
          continue;
        }
      }

      if (!shouldKeepAsString(key)) {
        const maybeNumber = parseLocaleNumber(value);
        if (maybeNumber !== null) {
          cleaned[key] = maybeNumber;
          continue;
        }
      }

      cleaned[key] = value;
    }

    return cleaned;
  });
};

export const buildImportMutationPlan = (rows: ImportedRow[]) => {
  const rowsWithId: ImportedRow[] = [];
  const rowsWithoutId: ImportedRow[] = [];

  rows.forEach((row) => {
    if (typeof row.id === "string" && row.id.trim()) {
      rowsWithId.push(row);
      return;
    }

    if (row.id) {
      rowsWithId.push(row);
      return;
    }

    const { id, ...rowWithoutId } = row;
    rowsWithoutId.push(rowWithoutId);
  });

  return {
    rowsWithId,
    rowsWithoutId,
    totalRows: rows.length,
  };
};