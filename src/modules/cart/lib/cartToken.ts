/**
 * Cart token management — anonymous UUID persisted in localStorage.
 * Shared by web and WhatsApp Flow to keep the cart in sync.
 */
const TOKEN_KEY = "tenant_cart_token";
const LEGACY_KEY = "surteya_cart_token";

const uuid = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (RFC4122 v4)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getCartToken = (): string => {
  try {
    let t = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!t) {
      t = uuid();
    }
    localStorage.setItem(TOKEN_KEY, t);
    return t;
  } catch {
    return uuid();
  }
};

export const resetCartToken = (): string => {
  const t = uuid();
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
  return t;
};

export const setCartToken = (token: string) => {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
};
