import { describe, it, expect } from "vitest";
import { compareVersions, isNewerVersion } from "./CompareVersions";

describe("compareVersions", () => {
  it("compara mayor/menor/patch", () => {
    expect(compareVersions("1.4.0", "1.3.9")).toBe(1);
    expect(compareVersions("1.3.9", "1.4.0")).toBe(-1);
    expect(compareVersions("2.0.0", "10.0.0")).toBe(-1);
    expect(compareVersions("1.4.0", "1.4.0")).toBe(0);
  });

  it("tolera prefijo v y longitudes distintas", () => {
    expect(compareVersions("v1.5", "1.5.0")).toBe(0);
    expect(compareVersions("1.5.1", "v1.5")).toBe(1);
  });

  it("isNewerVersion es estricto", () => {
    expect(isNewerVersion("1.4.1", "1.4.0")).toBe(true);
    expect(isNewerVersion("1.4.0", "1.4.0")).toBe(false);
    expect(isNewerVersion("1.3.0", "1.4.0")).toBe(false);
  });
});
