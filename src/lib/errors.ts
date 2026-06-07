/**
 * Mapper centralizado de errores → mensajes amigables (es-CO).
 * Cubre errores de Supabase/PostgREST, red, auth y JS genérico.
 *
 * Uso:
 *   try { ... } catch (e) { toast.error(errorToMessage(e)); }
 */

type AnyError = unknown;

interface NormalizedError {
  message: string;
  code?: string;
  /** Mensaje técnico (para console.error), no para la UI. */
  technical?: string;
}

const POSTGREST_CODE_MAP: Record<string, string> = {
  // Constraints
  "23505": "Ya existe un registro con esos datos.",
  "23503": "No se puede completar: este registro está en uso.",
  "23502": "Falta un campo obligatorio.",
  "23514": "Alguno de los datos no cumple las reglas de validación.",
  // RLS / permisos
  "42501": "No tienes permiso para realizar esta acción.",
  PGRST301: "Tu sesión expiró. Vuelve a iniciar sesión.",
  PGRST116: "No se encontró el registro solicitado.",
  // Conexión / configuración
  "08006": "Conexión perdida con el servidor. Intenta de nuevo.",
  "57014": "La operación tardó demasiado y fue cancelada.",
};

const AUTH_MESSAGE_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Debes confirmar tu correo antes de iniciar sesión."],
  [/user already registered/i, "Ya existe una cuenta con ese correo."],
  [/password should be at least/i, "La contraseña es muy corta."],
  [/rate limit/i, "Demasiados intentos. Espera unos minutos."],
  [/network/i, "Sin conexión. Verifica tu internet e intenta de nuevo."],
  [/failed to fetch/i, "No se pudo contactar al servidor. Revisa tu conexión."],
];

export function normalizeError(err: AnyError): NormalizedError {
  if (!err) return { message: "Ocurrió un error inesperado." };

  // String suelto
  if (typeof err === "string") return { message: err, technical: err };

  const anyErr = err as Record<string, unknown>;
  const code = typeof anyErr.code === "string" ? anyErr.code : undefined;
  const rawMessage =
    (typeof anyErr.message === "string" && anyErr.message) ||
    (typeof anyErr.error_description === "string" && anyErr.error_description) ||
    (typeof anyErr.error === "string" && anyErr.error) ||
    "Ocurrió un error inesperado.";

  // 1) Supabase/PostgREST por código
  if (code && POSTGREST_CODE_MAP[code]) {
    return { message: POSTGREST_CODE_MAP[code], code, technical: rawMessage };
  }

  // 2) Auth / red por patrón de mensaje
  for (const [pattern, friendly] of AUTH_MESSAGE_MAP) {
    if (pattern.test(rawMessage)) return { message: friendly, code, technical: rawMessage };
  }

  // 3) HTTP status numérico
  const status = typeof anyErr.status === "number" ? anyErr.status : undefined;
  if (status === 401 || status === 403) {
    return { message: "No tienes permiso para esta acción.", code, technical: rawMessage };
  }
  if (status === 404) {
    return { message: "No se encontró el recurso solicitado.", code, technical: rawMessage };
  }
  if (status === 429) {
    return { message: "Demasiadas solicitudes. Espera un momento.", code, technical: rawMessage };
  }
  if (status && status >= 500) {
    return { message: "El servidor tuvo un problema. Intenta de nuevo en un momento.", code, technical: rawMessage };
  }

  // 4) Mensaje crudo pero acotado para que no se vea espantoso
  const trimmed = rawMessage.length > 180 ? `${rawMessage.slice(0, 177)}…` : rawMessage;
  return { message: trimmed, code, technical: rawMessage };
}

export function errorToMessage(err: AnyError): string {
  return normalizeError(err).message;
}

/**
 * Envuelve una promesa async para no tener que repetir try/catch.
 * Devuelve `[data, error]` estilo Go. El error ya viene normalizado.
 *
 * Ejemplo:
 *   const [data, err] = await safeAsync(supabase.from('x').select());
 *   if (err) return toast.error(err.message);
 */
export async function safeAsync<T>(
  promise: Promise<T>
): Promise<[T, null] | [null, NormalizedError]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (e) {
    const normalized = normalizeError(e);
    // eslint-disable-next-line no-console
    console.error("[safeAsync]", normalized.technical ?? normalized.message, e);
    return [null, normalized];
  }
}
