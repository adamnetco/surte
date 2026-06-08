/**
 * Login state machine — pure, framework-agnostic.
 * Driven by useLoginFlow. Backend integration via edge functions
 * (auth-login-challenge, auth-totp-verify, auth-webauthn-login-*,
 * auth-recovery-consume) is wired when Lovable Cloud responds.
 *
 * States:
 *   idle → askEmail → choosingMethod → verifying → success
 *                                              ↘ recovery → verifying
 *                                              ↘ error (recoverable)
 */

export type AuthMethod =
  | "passkey"
  | "google"
  | "password_totp"
  | "magic_link"
  | "recovery";

export interface FactorSummary {
  method: AuthMethod;
  enrolled: boolean;
  label: string;
}

export type LoginState =
  | { status: "idle" }
  | { status: "askEmail"; error?: string }
  | { status: "choosingMethod"; email: string; factors: FactorSummary[] }
  | { status: "verifying"; email: string; method: AuthMethod }
  | { status: "recovery"; email: string }
  | { status: "error"; email?: string; message: string; recoverable: boolean }
  | { status: "success"; email: string };

export type LoginEvent =
  | { type: "START" }
  | { type: "EMAIL_SUBMITTED"; email: string; factors: FactorSummary[] }
  | { type: "EMAIL_FAILED"; message: string }
  | { type: "METHOD_CHOSEN"; method: AuthMethod }
  | { type: "VERIFY_OK" }
  | { type: "VERIFY_FAIL"; message: string; recoverable?: boolean }
  | { type: "USE_RECOVERY" }
  | { type: "RESET" };

export const initialLoginState: LoginState = { status: "idle" };

export function loginReducer(state: LoginState, event: LoginEvent): LoginState {
  switch (event.type) {
    case "START":
      return { status: "askEmail" };

    case "EMAIL_SUBMITTED":
      if (state.status !== "askEmail") return state;
      return {
        status: "choosingMethod",
        email: event.email,
        factors: event.factors,
      };

    case "EMAIL_FAILED":
      return { status: "askEmail", error: event.message };

    case "METHOD_CHOSEN":
      if (state.status !== "choosingMethod" && state.status !== "recovery") return state;
      return {
        status: "verifying",
        email: state.status === "choosingMethod" ? state.email : state.email,
        method: event.method,
      };

    case "VERIFY_OK":
      if (state.status !== "verifying") return state;
      return { status: "success", email: state.email };

    case "VERIFY_FAIL":
      if (state.status !== "verifying") return state;
      return {
        status: "error",
        email: state.email,
        message: event.message,
        recoverable: event.recoverable ?? true,
      };

    case "USE_RECOVERY": {
      const email =
        state.status === "choosingMethod" || state.status === "verifying" || state.status === "error"
          ? state.email
          : undefined;
      if (!email) return state;
      return { status: "recovery", email };
    }

    case "RESET":
      return initialLoginState;

    default:
      return state;
  }
}

/** Method ranking: strongest first. */
export const METHOD_PRIORITY: AuthMethod[] = [
  "passkey",
  "password_totp",
  "google",
  "magic_link",
  "recovery",
];

export function pickStrongest(factors: FactorSummary[]): AuthMethod | null {
  const enrolled = factors.filter((f) => f.enrolled).map((f) => f.method);
  for (const m of METHOD_PRIORITY) if (enrolled.includes(m)) return m;
  return null;
}
