/**
 * Dev-only auth bypass.
 *
 * Activa una sesión falsa de superadmin SOLO cuando:
 *  1. `VITE_DEV_BYPASS_AUTH=1` está definido en el build, Y
 *  2. el host actual es localhost o un preview de Lovable.
 *
 * NUNCA se activa en producción (sistecpos.com, *.sistecpos.com),
 * incluso si la variable está presente, porque el chequeo de hostname
 * la corta. Esto permite trabajar la UI mientras Lovable Cloud está caído
 * sin abrir un agujero de seguridad en producción.
 *
 * El usuario falso tiene `id = "00000000-0000-0000-0000-000000000000"` y
 * email `dev-bypass@local`. Cualquier llamada a Supabase con este id fallará
 * por RLS — esto es intencional: el bypass es solo para navegar la UI.
 */
import type { Session, User } from "@supabase/supabase-js";

const PREVIEW_HOST_FRAGMENTS = [
  "localhost",
  "127.0.0.1",
  "id-preview--",
  "lovableproject.com",
  "lovable.app",
];

const isSafeHost = (): boolean => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return PREVIEW_HOST_FRAGMENTS.some((frag) => h.includes(frag));
};

export const isDevBypassEnabled = (): boolean => {
  // Vite reemplaza `import.meta.env.VITE_*` en build-time.
  const flag = (import.meta as any).env?.VITE_DEV_BYPASS_AUTH;
  return flag === "1" && isSafeHost();
};

export const buildBypassUser = (): User =>
  ({
    id: "00000000-0000-0000-0000-000000000000",
    aud: "authenticated",
    email: "dev-bypass@local",
    role: "authenticated",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    app_metadata: { provider: "dev-bypass" },
    user_metadata: { full_name: "Dev Bypass (Superadmin)" },
  } as unknown as User);

export const buildBypassSession = (): Session =>
  ({
    access_token: "dev-bypass",
    refresh_token: "dev-bypass",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: buildBypassUser(),
  } as unknown as Session);
