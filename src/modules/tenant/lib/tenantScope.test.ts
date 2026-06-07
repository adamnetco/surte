import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
    __builder: builder,
  };
});

import { scopedFrom, scopedSelect, tenantChannelFilter } from "@/lib/tenantScope";
import { supabase } from "@/integrations/supabase/client";

const ORG = "11111111-1111-1111-1111-111111111111";

describe("tenantScope", () => {
  it("scopedFrom lanza si no hay orgId", () => {
    expect(() => scopedFrom("products", "")).toThrow(/organization_id/);
    expect(() => scopedFrom("products", null)).toThrow();
    expect(() => scopedFrom("products", undefined)).toThrow();
  });

  it("scopedFrom invoca supabase.from(table).select().eq con organization_id", () => {
    scopedFrom("products", ORG);
    expect((supabase as any).from).toHaveBeenCalledWith("products");
    const b: any = (supabase as any).from.mock.results.at(-1)!.value;
    expect(b.select).toHaveBeenCalledWith("*");
    expect(b.eq).toHaveBeenCalledWith("organization_id", ORG);
  });

  it("scopedSelect aplica select + eq de organization_id", () => {
    scopedSelect("orders", ORG, "id,total");
    const b: any = (supabase as any).from.mock.results.at(-1)!.value;
    expect(b.select).toHaveBeenCalledWith("id,total");
    expect(b.eq).toHaveBeenCalledWith("organization_id", ORG);
  });

  it("scopedSelect lanza sin orgId", () => {
    expect(() => scopedSelect("orders", "")).toThrow();
  });

  it("tenantChannelFilter compone filtro Realtime", () => {
    expect(tenantChannelFilter(ORG)).toBe(`organization_id=eq.${ORG}`);
    expect(() => tenantChannelFilter("")).toThrow();
  });
});
