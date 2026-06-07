import { describe, expect, it } from "vitest";
import {
  analyzeImportRows,
  buildImportMutationPlan,
  cleanImportedRows,
  normalizeImportedHeaders,
  parseLocaleNumber,
} from "@/modules/admin-cms/lib/dataImportUtils";
import type { TableDef } from "@/modules/admin-cms/lib/csvUtils";

const def: TableDef = {
  name: "products",
  label: "Productos",
  table: "products",
  skipOnImport: ["created_at", "updated_at"],
};

describe("dataImportUtils", () => {
  it("normaliza encabezados con BOM y espacios", () => {
    expect(normalizeImportedHeaders([{ "\uFEFF id ": "123", " name ": "Salsa" }])).toEqual([
      { id: "123", name: "Salsa" },
    ]);
  });

  it("convierte números con formato local y deja claves sensibles como texto", () => {
    expect(parseLocaleNumber("120.000")).toBe(120000);
    expect(parseLocaleNumber("12,5")).toBe(12.5);

    expect(
      cleanImportedRows(
        [
          {
            id: "",
            price: "120.000",
            is_active: "TRUE",
            code: "0012",
            customer_phone: "3001234567",
          },
        ],
        def,
      ),
    ).toEqual([
      {
        price: 120000,
        is_active: true,
        code: "0012",
        customer_phone: "3001234567",
      },
    ]);
  });

  it("separa filas para actualizar y crear según tengan id", () => {
    const rows = [{ id: "abc", name: "A" }, { id: "", name: "B" }, { name: "C" }];

    expect(analyzeImportRows(rows)).toEqual({ rowsWithId: 1, rowsWithoutId: 2, blankIdRows: 1 });
    expect(buildImportMutationPlan(rows)).toEqual({
      rowsWithId: [{ id: "abc", name: "A" }],
      rowsWithoutId: [{ name: "B" }, { name: "C" }],
      totalRows: 3,
    });
  });
});