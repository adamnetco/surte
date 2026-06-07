export const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const isAuthLockAbort = (err: unknown): boolean => {
  const msg = String((err as any)?.message || err || "");
  return /Lock broken by another request with the 'steal' option/i.test(msg);
};

export const isTransientAuthError = (err: unknown): boolean => {
  const status = Number((err as any)?.status || 0);
  const msg = String((err as any)?.message || err || "");
  if (status === 0 || status === 408 || status === 429 || status >= 500) return true;
  return /AuthRetryableFetchError|Failed to fetch|NetworkError|timeout|upstream|fetch failed|load failed|refresh_token_not_found|Invalid Refresh Token/i.test(msg);
};

export const purgeLocalAuth = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") || key.startsWith("supabase.auth") || key.startsWith("sps_role:"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // quota / private mode
  }
};
