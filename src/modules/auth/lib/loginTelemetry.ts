/**
 * Telemetría de login unificada.
 *
 *  - Éxito: el cliente authenticated puede insertar su propio evento
 *    (RLS lo permite gracias a `user_id = auth.uid()`).
 *  - Fallo: no hay sesión, así que delegamos en la edge function
 *    `log-login-attempt` que usa service-role.
 *
 * Todas las llamadas son fire-and-forget: nunca deben bloquear el login.
 */
import { supabase } from "@/integrations/supabase/client";

type Method = "password" | "magic_link" | "google" | "otp" | "webauthn";

const currentRoute = (): string | null =>
  typeof window !== "undefined" ? window.location.pathname : null;

const currentUserAgent = (): string | null =>
  typeof navigator !== "undefined" ? navigator.userAgent : null;

export const logLoginSuccess = (params: { userId: string; email: string; method?: Method }) => {
  void supabase.from("auth_login_events").insert({
    user_id: params.userId,
    email: params.email,
    method: params.method ?? "password",
    success: true,
    user_agent: currentUserAgent(),
    details: { route: currentRoute() },
  });
};

export const logLoginFailure = (params: { email: string; method?: Method; reason: string }) => {
  void supabase.functions.invoke("log-login-attempt", {
    body: {
      email: params.email,
      method: params.method ?? "password",
      success: false,
      details: { route: currentRoute(), reason: params.reason },
    },
  });
};
