import { describe, it, expect } from "vitest";
import { forceOrgOnRows, ISLAND_TABLES } from "@/lib/tenantDataIsland";

describe("tenantDataIsland", () => {
  const ORG = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";

  it("siempre sobrescribe organization_id con el orgId activo", () => {
    const rows = [
      { id: "a", name: "P1", organization_id: OTHER },
      { id: "b", name: "P2" }, // sin org
      { id: "c", name: "P3", organization_id: null },
    ];
    const out = forceOrgOnRows(rows, ORG);
    expect(out).toHaveLength(3);
    for (const r of out) {
      expect(r.organization_id).toBe(ORG);
    }
  });

  it("respeta skipOnImport y elimina ids en blanco", () => {
    const rows = [
      { id: "", name: "Nuevo", created_at: "2020-01-01", updated_at: "2020-01-02" },
      { id: "x", name: "Existe", created_at: "2020-01-01" },
    ];
    const out = forceOrgOnRows(rows, ORG, ["created_at", "updated_at"]);
    expect(out[0]).not.toHaveProperty("id");
    expect(out[0]).not.toHaveProperty("created_at");
    expect(out[0]).not.toHaveProperty("updated_at");
    expect(out[0].organization_id).toBe(ORG);
    expect(out[1].id).toBe("x");
  });

  it("lanza si falta orgId", () => {
    expect(() => forceOrgOnRows([{ name: "x" }], "")).toThrow();
  });

  it("declara tablas con metadatos mínimos válidos", () => {
    for (const t of ISLAND_TABLES) {
      expect(t.name).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.table).toBeTruthy();
    }
  });
});
