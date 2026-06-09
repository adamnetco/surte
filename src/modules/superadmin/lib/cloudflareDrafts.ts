/**
 * Cloudflare drafts — local-first storage for CF accounts and per-domain wizard
 * state. While Lovable Cloud is down and the migration for
 * `tenant_cloudflare_accounts` + new `tenant_domains` columns isn't applied,
 * everything lives in localStorage. When Cloud returns, swap the load/save
 * helpers for `supabase.from('tenant_cloudflare_accounts')`.
 *
 * See `.lovable/pending-cloud-tasks.md` §1, §4, §5.
 */

export type DnsMode = "saas" | "cloudflare_account" | "manual";

export interface CloudflareAccount {
  id: string;
  organization_id: string;
  label: string;
  cf_account_id: string;
  cf_zone_id?: string;
  api_token_masked: string; // never store full token in LS
  is_default: boolean;
  created_at: string;
}

export interface DomainDraft {
  domain_id: string; // tenant_domains.id
  dns_mode: DnsMode;
  cf_account_id?: string;
  cname_target?: string;
  cf_ownership_verification?: {
    name: string;
    type: "txt";
    value: string;
  };
  cf_status?: "pending" | "active" | "moved";
  cf_ssl_status?: "initializing" | "pending_validation" | "pending_issuance" | "active" | "failed";
  last_checked_at?: string;
}

const ACCOUNTS_KEY = "sistecpos:cf_accounts:draft";
const DOMAINS_KEY = "sistecpos:cf_domains:draft";

// ---------- accounts ----------

export function loadCfAccounts(orgId: string): CloudflareAccount[] {
  try {
    const all = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as CloudflareAccount[];
    return all.filter((a) => a.organization_id === orgId);
  } catch {
    return [];
  }
}

export function saveCfAccount(account: CloudflareAccount): void {
  const all = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as CloudflareAccount[];
  const idx = all.findIndex((a) => a.id === account.id);
  if (account.is_default) {
    all.forEach((a) => {
      if (a.organization_id === account.organization_id) a.is_default = false;
    });
  }
  if (idx >= 0) all[idx] = account;
  else all.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all));
}

export function deleteCfAccount(id: string): void {
  const all = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as CloudflareAccount[];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all.filter((a) => a.id !== id)));
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "•".repeat(token.length);
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

// ---------- per-domain drafts ----------

export function loadDomainDraft(domainId: string): DomainDraft | null {
  try {
    const all = JSON.parse(localStorage.getItem(DOMAINS_KEY) ?? "{}") as Record<string, DomainDraft>;
    return all[domainId] ?? null;
  } catch {
    return null;
  }
}

export function saveDomainDraft(draft: DomainDraft): void {
  const all = JSON.parse(localStorage.getItem(DOMAINS_KEY) ?? "{}") as Record<string, DomainDraft>;
  all[draft.domain_id] = draft;
  localStorage.setItem(DOMAINS_KEY, JSON.stringify(all));
}

// ---------- wizard helpers (mock until edge functions exist) ----------

/**
 * Mock for the `cloudflare-domain-connect` edge function. Produces deterministic
 * CNAME target + TXT DCV record based on the hostname so the UI can be tested
 * end to end without Cloud.
 */
export function mockConnect(hostname: string, mode: DnsMode): DomainDraft {
  const fingerprint = Array.from(hostname).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0).toString(16);
  return {
    domain_id: "",
    dns_mode: mode,
    cname_target:
      mode === "saas"
        ? `${hostname.replace(/\./g, "-")}.cdn.sistecpos.com`
        : `${hostname.replace(/\./g, "-")}.customers.cloudflare.com`,
    cf_ownership_verification: {
      name: `_cf-custom-hostname.${hostname}`,
      type: "txt",
      value: `ca3-${fingerprint}`,
    },
    cf_status: "pending",
    cf_ssl_status: "pending_validation",
    last_checked_at: new Date().toISOString(),
  };
}

/** Mock progression for the status checker. */
export function mockAdvanceStatus(draft: DomainDraft): DomainDraft {
  const next: DomainDraft = { ...draft, last_checked_at: new Date().toISOString() };
  const sequence: DomainDraft["cf_ssl_status"][] = [
    "pending_validation",
    "pending_issuance",
    "active",
  ];
  const i = sequence.indexOf(draft.cf_ssl_status ?? "pending_validation");
  next.cf_ssl_status = sequence[Math.min(i + 1, sequence.length - 1)];
  if (next.cf_ssl_status === "active") next.cf_status = "active";
  return next;
}
