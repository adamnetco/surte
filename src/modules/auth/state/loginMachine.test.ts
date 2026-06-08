import { describe, expect, it } from "vitest";
import {
  initialLoginState,
  loginReducer,
  pickStrongest,
  type FactorSummary,
} from "./loginMachine";

const factors: FactorSummary[] = [
  { method: "passkey", enrolled: true, label: "Passkey" },
  { method: "password_totp", enrolled: true, label: "Password+TOTP" },
  { method: "recovery", enrolled: true, label: "Recovery" },
];

describe("loginMachine", () => {
  it("starts idle, transitions through happy path", () => {
    let s = loginReducer(initialLoginState, { type: "START" });
    expect(s.status).toBe("askEmail");

    s = loginReducer(s, { type: "EMAIL_SUBMITTED", email: "a@b.com", factors });
    expect(s.status).toBe("choosingMethod");

    s = loginReducer(s, { type: "METHOD_CHOSEN", method: "passkey" });
    expect(s.status).toBe("verifying");

    s = loginReducer(s, { type: "VERIFY_OK" });
    expect(s.status).toBe("success");
  });

  it("handles verify fail → recoverable error", () => {
    let s = loginReducer(initialLoginState, { type: "START" });
    s = loginReducer(s, { type: "EMAIL_SUBMITTED", email: "x@y.com", factors });
    s = loginReducer(s, { type: "METHOD_CHOSEN", method: "password_totp" });
    s = loginReducer(s, { type: "VERIFY_FAIL", message: "bad code" });
    expect(s.status).toBe("error");
    if (s.status === "error") expect(s.recoverable).toBe(true);
  });

  it("falls back to recovery from choosingMethod", () => {
    let s = loginReducer(initialLoginState, { type: "START" });
    s = loginReducer(s, { type: "EMAIL_SUBMITTED", email: "x@y.com", factors });
    s = loginReducer(s, { type: "USE_RECOVERY" });
    expect(s.status).toBe("recovery");
  });

  it("picks the strongest enrolled factor", () => {
    expect(pickStrongest(factors)).toBe("passkey");
    expect(
      pickStrongest([
        { method: "passkey", enrolled: false, label: "" },
        { method: "magic_link", enrolled: true, label: "" },
        { method: "password_totp", enrolled: true, label: "" },
      ]),
    ).toBe("password_totp");
    expect(pickStrongest([])).toBeNull();
  });

  it("EMAIL_FAILED keeps user on email step with error", () => {
    let s = loginReducer(initialLoginState, { type: "START" });
    s = loginReducer(s, { type: "EMAIL_FAILED", message: "invalid" });
    expect(s.status).toBe("askEmail");
    if (s.status === "askEmail") expect(s.error).toBe("invalid");
  });
});
