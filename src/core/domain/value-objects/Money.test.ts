import { describe, it, expect } from "vitest";
import { money, add, subtract, multiply, zero, isZero, isNegative } from "./Money";

describe("Money", () => {
  it("redondea COP a entero", () => {
    expect(money(1234.7).amount).toBe(1235);
    expect(money(1234.4).amount).toBe(1234);
  });

  it("conserva 2 decimales para USD", () => {
    expect(money(9.996, "USD").amount).toBe(10);
    expect(money(9.991, "USD").amount).toBe(9.99);
  });

  it("suma y resta preservan moneda", () => {
    const a = money(100);
    const b = money(50);
    expect(add(a, b).amount).toBe(150);
    expect(subtract(a, b).amount).toBe(50);
  });

  it("rechaza operaciones cross-currency", () => {
    expect(() => add(money(1, "COP"), money(1, "USD"))).toThrow();
  });

  it("multiplica y detecta cero/negativo", () => {
    expect(multiply(money(1000), 2.5).amount).toBe(2500);
    expect(isZero(zero())).toBe(true);
    expect(isNegative(money(-1))).toBe(true);
  });
});
