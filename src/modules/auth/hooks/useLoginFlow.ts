import { useCallback, useReducer } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  initialLoginState,
  loginReducer,
  type AuthMethod,
  type FactorSummary,
  type LoginState,
} from "@/modules/auth/state/loginMachine";

interface ChallengeResponse {
  factors: FactorSummary[];
}

/** Default factors used when the backend is unavailable. */
const DEFAULT_FACTORS: FactorSummary[] = [
  { method: "passkey", enrolled: false, label: "Llave de acceso (Passkey)" },
  { method: "google", enrolled: true, label: "Continuar con Google" },
  { method: "password_totp", enrolled: true, label: "Contraseña + código" },
  { method: "magic_link", enrolled: true, label: "Enlace mágico al email" },
  { method: "recovery", enrolled: false, label: "Código de recuperación" },
];

export interface UseLoginFlow {
  state: LoginState;
  start: () => void;
  submitEmail: (email: string) => Promise<void>;
  chooseMethod: (method: AuthMethod) => void;
  reportVerifyResult: (ok: boolean, message?: string) => void;
  useRecovery: () => void;
  reset: () => void;
}

export const useLoginFlow = (): UseLoginFlow => {
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);

  const submitEmail = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      dispatch({ type: "EMAIL_FAILED", message: "Email inválido" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke<ChallengeResponse>(
        "auth-login-challenge",
        { body: { email: trimmed } },
      );
      const factors =
        !error && data?.factors?.length ? data.factors : DEFAULT_FACTORS;
      dispatch({ type: "EMAIL_SUBMITTED", email: trimmed, factors });
    } catch {
      // Cloud caído → fallback al set por defecto para no bloquear la UI
      dispatch({ type: "EMAIL_SUBMITTED", email: trimmed, factors: DEFAULT_FACTORS });
    }
  }, []);

  return {
    state,
    start: () => dispatch({ type: "START" }),
    submitEmail,
    chooseMethod: (method) => dispatch({ type: "METHOD_CHOSEN", method }),
    reportVerifyResult: (ok, message) =>
      dispatch(
        ok
          ? { type: "VERIFY_OK" }
          : { type: "VERIFY_FAIL", message: message ?? "No pudimos verificar tu identidad" },
      ),
    useRecovery: () => dispatch({ type: "USE_RECOVERY" }),
    reset: () => dispatch({ type: "RESET" }),
  };
};
