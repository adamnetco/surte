import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, User as UserIcon, Lock, Eye, EyeOff, Loader2, ShieldCheck, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/modules/auth/context/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";
import HeadMeta from "@/modules/marketing/seo/HeadMeta";
import { isTransientAuthError, purgeLocalAuth, sleep } from "@/modules/auth/lib/authRecovery";
import {
  logAuth,
  checkMagicLinkGate,
  recordMagicLinkAttempt,
  type MagicLinkGate,
} from "@/modules/auth/lib/authLog";

const MASTER_EMAIL = "eduardotp77@gmail.com";

/**
 * Portal de acceso unificado de SistecPOS (renderizado en `/` para
 * subdominios del sistema: admin/app/www/pos/mi).
 *
 * Form: tienda (id_negocio) · usuario · contraseña · Google.
 * Tras login redirige según rol:
 *  - superadmin → /superadmin
 *  - admin/editor → /admin
 *  - agente → /pos
 *  - user → /clientes
 */
const LoginRouter = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, role, loading: authLoading, signIn } = useAuth();
  const tenant = detectTenant();

  // Pre-fill tienda from subdomain when it looks like a storefront slug.
  const initialTienda = isStorefrontTenant(tenant) ? tenant : (params.get("tienda") ?? "");

  const [tienda, setTienda] = useState(initialTienda);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailLinkLoading, setEmailLinkLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [hasStaleTokens, setHasStaleTokens] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [gate, setGate] = useState<MagicLinkGate>(() => checkMagicLinkGate());
  const redirectedRef = useRef(false);

  const destinationFor = (mail: string | null | undefined, r: AppRole | null, tenantSlug = tienda.trim().toLowerCase()): string => {
    if ((mail ?? "").toLowerCase() === MASTER_EMAIL) return "/superadmin";
    if (r === "superadmin") return "/superadmin";
    const slug = tenantSlug.trim().toLowerCase();
    if (slug && (r === "admin" || r === "editor")) return `/t/${slug}/admin`;
    if (r === "admin" || r === "editor") return "/admin";
    if (r === "agente") return "/pos";
    return "/clientes";
  };

  useEffect(() => {
    try {
      setHasStaleTokens(Object.keys(localStorage).some((key) => key.startsWith("sb-") && /auth-token/.test(key)));
    } catch {
      setHasStaleTokens(false);
    }
    logAuth({ level: "info", event: "login_page_mounted", tenant, detail: `host=${window.location.hostname}` });
  }, [tenant]);

  // Tick the gate clock so the resend button auto-enables when cooldown ends.
  useEffect(() => {
    const id = window.setInterval(() => setGate(checkMagicLinkGate()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const signInWithRetry = async (mail: string, pwd: string) => {
    let last: Awaited<ReturnType<typeof signIn>> | null = null;
    for (const delay of [0, 800, 2000, 4000]) {
      if (delay) await sleep(delay);
      last = await signIn(mail, pwd);
      if (!last.error || !isTransientAuthError(last.error)) return last;
    }
    return last ?? { error: new Error("Auth retry failed"), session: null, role: null };
  };

  const clearStaleAuthAndReload = () => {
    purgeLocalAuth();
    logAuth({ level: "warn", event: "local_auth_purged" });
    toast.success("Sesión local limpiada. Recargando…");
    window.setTimeout(() => window.location.reload(), 400);
  };

  const handleEmailLink = async () => {
    const mail = email.trim().toLowerCase();
    const tenantSlug = tienda.trim().toLowerCase();
    if (!mail) {
      toast.error("Ingresa tu email para enviarte el acceso.");
      return;
    }
    if (!tenantSlug && mail !== MASTER_EMAIL) {
      toast.error("Ingresa el id_negocio de tu tienda para enviar el acceso.");
      return;
    }

    const currentGate = checkMagicLinkGate();
    if (!currentGate.allowed) {
      const seconds = Math.ceil((currentGate.remainingMs ?? 0) / 1000);
      const msg = currentGate.reason === "cooldown"
        ? `Espera ${seconds}s antes de reenviar el enlace.`
        : `Llegaste al máximo de ${currentGate.attemptsMax} intentos. Reintenta en ${Math.ceil(seconds / 60)} min o revisa /auth-status.`;
      toast.error(msg);
      logAuth({ level: "warn", event: "magic_link_blocked", detail: msg, tenant: tenantSlug, email: mail });
      setGate(currentGate);
      return;
    }

    setEmailLinkLoading(true);
    setBackendDown(false);
    try {
      if (tenantSlug) {
        try { sessionStorage.setItem("sps_tenant_override", tenantSlug); } catch { /* noop */ }
      }
      const redirectTo = new URL("/admin/login", window.location.origin);
      if (tenantSlug) redirectTo.searchParams.set("tienda", tenantSlug);
      logAuth({ level: "info", event: "magic_link_request", detail: `redirectTo=${redirectTo.toString()}`, tenant: tenantSlug, email: mail });
      const { error } = await supabase.auth.signInWithOtp({
        email: mail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo.toString(),
        },
      });
      if (error) throw error;
      recordMagicLinkAttempt();
      setGate(checkMagicLinkGate());
      setMagicLinkSent(true);
      logAuth({ level: "success", event: "magic_link_sent", tenant: tenantSlug, email: mail });
      toast.success("Te envié un enlace de acceso. Revisa tu correo y entra sin contraseña.");
    } catch (err: any) {
      const msg = err?.message || "";
      logAuth({ level: "error", event: "magic_link_failed", detail: msg, tenant: tenantSlug, email: mail });
      if (isTransientAuthError(err)) {
        setBackendDown(true);
        toast.error("El servidor de autenticación está intermitente. Intenta reenviar el acceso en unos segundos.");
      } else if (/signup disabled|user not found|not found/i.test(msg)) {
        toast.error("Ese email no está registrado. Verifica el correo o pide al administrador crear el usuario.");
      } else {
        toast.error(msg || "No pude enviar el acceso por email.");
      }
    } finally {
      setEmailLinkLoading(false);
    }
  };


  useEffect(() => {
    if (authLoading || redirectedRef.current || !user) return;
    redirectedRef.current = true;
    if (tienda) {
      try { sessionStorage.setItem("sps_tenant_override", tienda); } catch { /* noop */ }
    }
    const dest = destinationFor(user.email, role);
    logAuth({ level: "success", event: "auto_redirect_after_session", detail: `dest=${dest} role=${role}`, tenant: tienda || null, email: user.email });
    navigate(dest, { replace: true });
  }, [authLoading, user, role, tienda, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tenantSlug = tienda.trim().toLowerCase();
    if (!tenantSlug && email.trim().toLowerCase() !== MASTER_EMAIL) {
      toast.error("Ingresa el id_negocio de tu tienda para continuar.");
      return;
    }
    setLoading(true);
    setBackendDown(false);
    logAuth({ level: "info", event: "password_signin_attempt", tenant: tenantSlug, email: email.trim() });
    try {
      const { error, session, role: signedInRole } = await signInWithRetry(email.trim(), password);
      if (error) throw error;
      if (tenantSlug) {
        try { sessionStorage.setItem("sps_tenant_override", tenantSlug); } catch { /* noop */ }
      }
      const dest = destinationFor(session?.user?.email ?? email, signedInRole ?? role, tenantSlug);
      logAuth({ level: "success", event: "password_signin_ok", detail: `dest=${dest} role=${signedInRole}`, tenant: tenantSlug, email: session?.user?.email ?? email });
      toast.success("¡Bienvenido!");
      redirectedRef.current = true;
      navigate(dest, { replace: true });
    } catch (err: any) {
      const msg = err?.message || "";
      let friendly = "No pudimos iniciar sesión.";
      if (isTransientAuthError(err)) {
        friendly = "El servidor de autenticación está inestable. Reintenté varias veces; prueba de nuevo en unos segundos.";
        setBackendDown(true);
      } else if (/Invalid login credentials/i.test(msg)) friendly = "Usuario o contraseña incorrectos.";
      else if (/Email not confirmed/i.test(msg)) friendly = "Tu correo no está confirmado.";
      else if (msg) friendly = msg;
      logAuth({ level: "error", event: "password_signin_failed", detail: msg || friendly, tenant: tenantSlug, email: email.trim() });
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };


  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      if (tienda) {
        try { sessionStorage.setItem("sps_tenant_override", tienda); } catch { /* noop */ }
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.redirected) return;
      if (result.error) throw result.error;
    } catch (err: any) {
      toast.error(err?.message || "Error al iniciar con Google");
      setGoogleLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 text-white/70 text-sm">
        <Loader2 className="animate-spin mr-2" size={16} /> Cargando…
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      <HeadMeta
        title="SistecPOS · Iniciar sesión"
        description="Acceso al sistema SistecPOS multi-tenant. Ingresa con tu tienda, usuario y contraseña."
      />

      <header className="px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <span className="font-heading font-bold tracking-tight">SistecPOS</span>
        </div>
        <span className="text-xs text-white/40">sistecpos.com</span>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">Inicia sesión</h1>
            <p className="text-white/50 text-sm mt-1">Tu panel multi-tenant para administrar tus tiendas.</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-white/60 ml-1 mb-1 block uppercase tracking-wider">
                  Tienda (id_negocio)
                </label>
                <div className="relative">
                  <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={tienda}
                    onChange={(e) => setTienda(e.target.value.toLowerCase().trim())}
                    placeholder="ej: demo"
                    autoComplete="organization"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:bg-white/10 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-white/60 ml-1 mb-1 block uppercase tracking-wider">
                  Usuario / Email
                </label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:bg-white/10 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-white/60 ml-1 mb-1 block uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-primary/60 focus:bg-white/10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    aria-label={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => navigate("/reset-password")}
                  className="text-xs text-white/60 hover:text-white"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-xl py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
              >
                {loading && <Loader2 className="animate-spin" size={16} />}
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>

            {(backendDown || hasStaleTokens) && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                <p>
                  {backendDown
                    ? "La autenticación está tardando más de lo normal. Si el problema continúa, limpia la sesión local e intenta de nuevo."
                    : "Hay una sesión local guardada. Si no puedes entrar, puedes limpiarla y volver a intentarlo."}
                </p>
                <button
                  type="button"
                  onClick={clearStaleAuthAndReload}
                  className="mt-2 text-white underline decoration-white/30 underline-offset-4 hover:text-white/80"
                >
                  Limpiar sesión local
                </button>
              </div>
            )}

            <div className="relative my-4 flex items-center">
              <div className="border-t border-white/10 flex-1" />
              <span className="px-3 text-[10px] uppercase tracking-wider text-white/40">o</span>
              <div className="border-t border-white/10 flex-1" />
            </div>

            {(() => {
              const cooldownLeft = !gate.allowed && gate.reason === "cooldown" ? Math.ceil((gate.remainingMs ?? 0) / 1000) : 0;
              const maxed = !gate.allowed && gate.reason === "max_attempts";
              const disabled = emailLinkLoading || !gate.allowed;
              const label = emailLinkLoading
                ? "Enviando acceso…"
                : maxed
                  ? `Máx. ${gate.attemptsMax} intentos · espera ${Math.ceil((gate.remainingMs ?? 0) / 60000)} min`
                  : cooldownLeft > 0
                    ? `Reenviar en ${cooldownLeft}s`
                    : magicLinkSent
                      ? "Reenviar acceso por email"
                      : "Enviar acceso por email";
              return (
                <>
                  <button
                    type="button"
                    onClick={handleEmailLink}
                    disabled={disabled}
                    className="w-full mb-2 flex items-center justify-center gap-2.5 bg-white/10 border border-white/10 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors disabled:opacity-60"
                  >
                    {emailLinkLoading ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                    {label}
                  </button>
                  <div className="mb-3 text-[11px] text-white/50 flex items-center justify-between px-1">
                    <span>Intentos: {gate.attemptsUsed}/{gate.attemptsMax}</span>
                    <a href="/auth-status" className="underline decoration-white/30 hover:text-white">Ver estado de autenticación</a>
                  </div>
                  {magicLinkSent && !emailLinkLoading && (
                    <p className="mb-3 text-[11px] text-green-300/90 px-1">
                      ✓ Enlace enviado a <code>{email.trim().toLowerCase()}</code>. Revisa tu bandeja y spam.
                    </p>
                  )}
                </>
              );
            })()}


            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-white text-slate-900 rounded-xl py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {googleLoading ? "Conectando…" : "Continuar con Google"}
            </button>
          </div>

          <p className="mt-5 text-[11px] text-white/40 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck size={12} /> Conexión cifrada · Datos protegidos
          </p>

        </motion.div>
      </section>

      <footer className="px-6 py-4 text-center text-[11px] text-white/30">
        © {new Date().getFullYear()} SistecPOS · Multi-tenant POS para Colombia
      </footer>
    </main>
  );
};

export default LoginRouter;
