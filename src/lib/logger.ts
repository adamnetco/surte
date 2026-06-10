/**
 * Wrapper único de logging para SistecPOS Core.
 *
 * Objetivo (Fase 5 del plan de refactor):
 *  - Centralizar `console.*` para poder enchufar Sentry / tabla `app_errors`
 *    sin tocar cada call-site.
 *  - En dev: comportamiento idéntico a `console`.
 *  - En prod: `debug` queda silenciado; `error` + `warn` se reenvían al
 *    backend cuando esté disponible (placeholder hasta integrar Sentry).
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.error("checkout failed", err, { orderId });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = import.meta.env.DEV;

function emit(level: LogLevel, args: unknown[]) {
  // eslint-disable-next-line no-console
  const fn = (console as unknown as Record<LogLevel, (...a: unknown[]) => void>)[level];
  fn?.(...args);
}

function report(level: "warn" | "error", args: unknown[]) {
  // Placeholder: cuando se integre Sentry o la tabla `app_errors`,
  // enviar aquí. Por ahora, solo persistimos a sessionStorage para
  // poder inspeccionarlo desde DevTools en producción.
  try {
    if (typeof window === "undefined") return;
    const key = "__sistecpos_log_buffer__";
    const raw = sessionStorage.getItem(key);
    const buf = raw ? (JSON.parse(raw) as unknown[]) : [];
    buf.push({ ts: Date.now(), level, args: args.map((a) => (a instanceof Error ? { message: a.message, stack: a.stack } : a)) });
    // Cap to last 100 entries.
    sessionStorage.setItem(key, JSON.stringify(buf.slice(-100)));
  } catch {
    /* sessionStorage puede estar bloqueado, ignorar */
  }
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) emit("debug", args);
  },
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => {
    emit("warn", args);
    if (!isDev) report("warn", args);
  },
  error: (...args: unknown[]) => {
    emit("error", args);
    if (!isDev) report("error", args);
  },
};

export type Logger = typeof logger;
