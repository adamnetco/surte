/**
 * Role cache + helpers para AuthContext.
 *
 * Por qué existe:
 *  - Evita el flash de "Verificando permisos…" en cada navegación hidratando
 *    el rol desde localStorage antes de que el RPC retorne.
 *  - Centraliza la prioridad de roles para que no diverja entre componentes.
 */

export type AppRole = "superadmin" | "admin" | "editor" | "agente" | "user";

export const ROLE_PRIORITY: AppRole[] = ["superadmin", "admin", "editor", "agente", "user"];

const ROLE_CACHE_PREFIX = "sps_role:";

export const isAppRole = (v: unknown): v is AppRole =>
  typeof v === "string" && (ROLE_PRIORITY as string[]).includes(v);

export const normalizeRole = (value: string | null | undefined): AppRole =>
  isAppRole(value) ? value : "user";

export const pickHighestRole = (assigned: readonly (string | null | undefined)[]): AppRole => {
  const set = new Set(assigned.filter(isAppRole));
  return ROLE_PRIORITY.find((r) => set.has(r)) ?? "user";
};

export const readCachedRole = (userId: string | null | undefined): AppRole | null => {
  if (!userId || typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ROLE_CACHE_PREFIX + userId);
  return isAppRole(v) ? v : null;
};

export const writeCachedRole = (userId: string, role: AppRole) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROLE_CACHE_PREFIX + userId, role);
  } catch {
    /* quota / private mode */
  }
};
