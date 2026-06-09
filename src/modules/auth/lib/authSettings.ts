/**
 * Auth settings — runtime config defaults.
 * Mirrors columns in `auth_settings` (singleton) from
 * `.lovable/pending-migrations/auth-system.sql`.
 *
 * Until Lovable Cloud responds and the migration runs, the panel reads
 * and writes these values to localStorage so the UI can be iterated and
 * reviewed. `loadAuthSettings()` / `saveAuthSettings()` are the swap points
 * for `supabase.from('auth_settings')` later.
 */

export type AuthMethodKey =
  | "passkey"
  | "google"
  | "password_totp"
  | "magic_link"
  | "recovery";

export type RoleKey = "superadmin" | "admin" | "editor" | "user";

export interface IdleTimeouts {
  superadmin: number;
  admin: number;
  editor: number;
  user: number;
}

export interface AuthSettings {
  methods_enabled: AuthMethodKey[];
  require_2fa_roles: RoleKey[];
  enforce_2fa_grace_days: number;
  superadmin_ip_allowlist: string[];
  superadmin_requires_passkey: boolean;
  break_glass_approvers: string[];
  break_glass_method: "email" | "email_and_totp";
  idle_timeout_minutes: IdleTimeouts;
  reauth_window_minutes: number;
  rate_limit_per_15min: number;
}

export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  methods_enabled: ["passkey", "google", "password_totp", "magic_link", "recovery"],
  require_2fa_roles: ["superadmin", "admin"],
  enforce_2fa_grace_days: 14,
  superadmin_ip_allowlist: [],
  superadmin_requires_passkey: true,
  break_glass_approvers: [],
  break_glass_method: "email_and_totp",
  idle_timeout_minutes: { superadmin: 15, admin: 60, editor: 240, user: 480 },
  reauth_window_minutes: 5,
  rate_limit_per_15min: 10,
};

const LS_KEY = "sistecpos:auth_settings:draft";

export function loadAuthSettings(): AuthSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_AUTH_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AuthSettings>;
    return { ...DEFAULT_AUTH_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_AUTH_SETTINGS;
  }
}

export function saveAuthSettings(settings: AuthSettings): void {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

export function resetAuthSettings(): void {
  localStorage.removeItem(LS_KEY);
}

export const METHOD_LABELS: Record<AuthMethodKey, string> = {
  passkey: "Passkey (WebAuthn)",
  google: "Google OAuth",
  password_totp: "Email + Password + TOTP",
  magic_link: "Magic Link (email OTP)",
  recovery: "Códigos de recuperación",
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  editor: "Editor",
  user: "Usuario",
};
