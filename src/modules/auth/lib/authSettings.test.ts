import { describe, it, expect, beforeEach } from "vitest";
import {
  loadAuthSettings,
  saveAuthSettings,
  resetAuthSettings,
  DEFAULT_AUTH_SETTINGS,
} from "./authSettings";

describe("authSettings", () => {
  beforeEach(() => localStorage.clear());

  it("returns defaults when nothing saved", () => {
    expect(loadAuthSettings()).toEqual(DEFAULT_AUTH_SETTINGS);
  });

  it("roundtrips a modified settings object", () => {
    const updated = {
      ...DEFAULT_AUTH_SETTINGS,
      enforce_2fa_grace_days: 30,
      break_glass_approvers: ["a@x.com", "b@x.com"],
    };
    saveAuthSettings(updated);
    expect(loadAuthSettings()).toEqual(updated);
  });

  it("merges with defaults so missing keys fall back", () => {
    localStorage.setItem(
      "sistecpos:auth_settings:draft",
      JSON.stringify({ enforce_2fa_grace_days: 7 }),
    );
    const loaded = loadAuthSettings();
    expect(loaded.enforce_2fa_grace_days).toBe(7);
    expect(loaded.methods_enabled).toEqual(DEFAULT_AUTH_SETTINGS.methods_enabled);
  });

  it("reset clears storage", () => {
    saveAuthSettings({ ...DEFAULT_AUTH_SETTINGS, enforce_2fa_grace_days: 1 });
    resetAuthSettings();
    expect(loadAuthSettings()).toEqual(DEFAULT_AUTH_SETTINGS);
  });

  it("survives corrupt JSON gracefully", () => {
    localStorage.setItem("sistecpos:auth_settings:draft", "not-json{");
    expect(loadAuthSettings()).toEqual(DEFAULT_AUTH_SETTINGS);
  });
});
