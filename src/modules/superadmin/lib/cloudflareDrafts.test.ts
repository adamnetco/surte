import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCfAccounts,
  saveCfAccount,
  deleteCfAccount,
  maskToken,
  loadDomainDraft,
  saveDomainDraft,
  mockConnect,
  mockAdvanceStatus,
  type CloudflareAccount,
} from "./cloudflareDrafts";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";

const makeAccount = (overrides: Partial<CloudflareAccount> = {}): CloudflareAccount => ({
  id: crypto.randomUUID(),
  organization_id: ORG_A,
  label: "Test",
  cf_account_id: "abc123",
  api_token_masked: "abcd…wxyz",
  is_default: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("cloudflareDrafts — accounts", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty list when nothing stored", () => {
    expect(loadCfAccounts(ORG_A)).toEqual([]);
  });

  it("scopes results to organization", () => {
    saveCfAccount(makeAccount({ organization_id: ORG_A, label: "A" }));
    saveCfAccount(makeAccount({ organization_id: ORG_B, label: "B" }));
    const a = loadCfAccounts(ORG_A);
    expect(a).toHaveLength(1);
    expect(a[0].label).toBe("A");
  });

  it("only one default per organization", () => {
    saveCfAccount(makeAccount({ label: "first", is_default: true }));
    saveCfAccount(makeAccount({ label: "second", is_default: true }));
    const defaults = loadCfAccounts(ORG_A).filter((a) => a.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe("second");
  });

  it("default in one org does not affect another", () => {
    saveCfAccount(makeAccount({ organization_id: ORG_A, is_default: true }));
    saveCfAccount(makeAccount({ organization_id: ORG_B, is_default: true }));
    expect(loadCfAccounts(ORG_A).filter((a) => a.is_default)).toHaveLength(1);
    expect(loadCfAccounts(ORG_B).filter((a) => a.is_default)).toHaveLength(1);
  });

  it("deletes by id", () => {
    const acc = makeAccount();
    saveCfAccount(acc);
    deleteCfAccount(acc.id);
    expect(loadCfAccounts(ORG_A)).toEqual([]);
  });

  it("masks tokens preserving first/last 4 chars", () => {
    expect(maskToken("1234567890abcdef")).toBe("1234…cdef");
    expect(maskToken("short")).toBe("•••••");
  });
});

describe("cloudflareDrafts — domain drafts", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when no draft saved", () => {
    expect(loadDomainDraft("missing")).toBeNull();
  });

  it("roundtrips a draft", () => {
    const draft = {
      domain_id: "dom-1",
      dns_mode: "saas" as const,
      cf_status: "pending" as const,
    };
    saveDomainDraft(draft);
    expect(loadDomainDraft("dom-1")).toEqual(draft);
  });
});

describe("cloudflareDrafts — wizard mocks", () => {
  it("mockConnect produces deterministic TXT for same hostname", () => {
    const a = mockConnect("surteya.com", "saas");
    const b = mockConnect("surteya.com", "saas");
    expect(a.cf_ownership_verification?.value).toBe(b.cf_ownership_verification?.value);
  });

  it("mockConnect SaaS vs cloudflare_account use different CNAME targets", () => {
    const saas = mockConnect("surteya.com", "saas");
    const own = mockConnect("surteya.com", "cloudflare_account");
    expect(saas.cname_target).not.toBe(own.cname_target);
  });

  it("mockAdvanceStatus progresses pending_validation → pending_issuance → active", () => {
    let d = mockConnect("x.com", "saas");
    expect(d.cf_ssl_status).toBe("pending_validation");
    d = mockAdvanceStatus(d);
    expect(d.cf_ssl_status).toBe("pending_issuance");
    d = mockAdvanceStatus(d);
    expect(d.cf_ssl_status).toBe("active");
    expect(d.cf_status).toBe("active");
  });

  it("mockAdvanceStatus is idempotent once active", () => {
    let d = mockConnect("x.com", "saas");
    d = mockAdvanceStatus(mockAdvanceStatus(mockAdvanceStatus(d)));
    const again = mockAdvanceStatus(d);
    expect(again.cf_ssl_status).toBe("active");
  });
});
