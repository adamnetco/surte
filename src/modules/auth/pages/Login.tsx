import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Phone, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { mailService } from "@/modules/email/mailService";
import { welcomeTemplate } from "@/modules/email/emailTemplates";
import surteLogo from "@/assets/surte-logo.png";

const MASTER_EMAIL = "eduardotp77@gmail.com";
const AUTH_WAIT_TIMEOUT_MS = 6000;

type BusinessTypeOption = { value: string; label: string; icon: string };
const BUSINESS_TYPES: BusinessTypeOption[] = [
  { value: "casa", label: "Casa / Consumidor", icon: "🏠" },
  { value: "detal", label: "Tienda Detal", icon: "🏪" },
  { value: "minimercado", label: "Minimercado", icon: "🛒" },
  { value: "horeca", label: "Restaurante / HORECA", icon: "🍽️" },
  { value: "distribuidor", label: "Salsamentaria / Distribuidor", icon: "🚚" },
];

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessType, setBusinessType] = useState("casa");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleTimedOut, setGoogleTimedOut] = useState(false);
  const { signIn, signUp, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = ((location.state as { from?: string } | null)?.from || "") as string;

  const redirectedRef = useRef(false);

  const resolveDestination = (mail?: string | null, currentRole?: string | null): string => {
    if (fromPath && fromPath !== "/login" && fromPath !== "/") return fromPath;
    const isMaster = (mail ?? "").toLowerCase() === MASTER_EMAIL;
    if (isMaster) return "/admin";
    if (currentRole === "superadmin" || currentRole === "admin") return "/admin";
    if (currentRole === "agente") return "/pos";
    return "/clientes";
  };

  // Auto-redirect si ya hay sesión al entrar a /login
  useEffect(() => {
    if (authLoading || redirectedRef.current) return;
    if (user) {
      redirectedRef.current = true;
      const dest = resolveDestination(user.email, role);
      navigate(dest, { replace: true });
    }
  }, [authLoading, user, role]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleTimedOut(false);
    const resetTimer = window.setTimeout(() => {
      setGoogleTimedOut(true);
      setGoogleLoading(false);
    }, 12000);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/login`,
        extraParams: { prompt: "select_account" },
      });
      if (result.redirected) {
        return;
      }
      if (result.error) throw result.error;
      window.clearTimeout(resetTimer);
      const session = await waitForAuthSession();
      const dest = resolveDestination(session?.user?.email, null);
      toast.success("¡Bienvenido!");
      navigate(dest, { replace: true });
    } catch (err: any) {
      window.clearTimeout(resetTimer);
      toast.error(err?.message || "Error al iniciar con Google");
      setGoogleLoading(false);
    }
  };

  const openInNewTab = () => {
    window.open(`${window.location.origin}/login`, "_blank", "noopener");
  };

  const isTransientAuthError = (err: any): boolean => {
    const msg = String(err?.message || "");
    const status = Number(err?.status || 0);
    if (status === 0 || status === 408 || status === 429 || status >= 500) return true;
    return /Failed to fetch|NetworkError|timeout|upstream|fetch failed|load failed/i.test(msg);
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const signInWithRetry = async (mail: string, pwd: string) => {
    let lastErr: any = null;
    const delays = [0, 800, 2000];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await sleep(delays[i]);
      const res = await signIn(mail, pwd);
      if (!res.error) return res;
      lastErr = res.error;
      if (!isTransientAuthError(res.error)) return res;
    }
    return { error: lastErr, session: null as any };
  };

  const clearStaleAuthAndReload = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.startsWith("supabase.auth") || k.startsWith("sps_role:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* quota */ }
    toast.success("Sesión local limpiada. Recargando…");
    setTimeout(() => window.location.reload(), 400);
  };

  const [backendDown, setBackendDown] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBackendDown(false);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, businessType, phone);
        if (error) throw error;
        mailService
          .send({
            to: email,
            subject: "¡Bienvenido a SURTÉ YA!",
            html: welcomeTemplate(fullName || "Cliente"),
          })
          .catch((err) => console.warn("Welcome email failed:", err));
        toast.success("¡Cuenta creada! Revisa tu email para confirmar.");
        setIsSignUp(false);
      } else {
        const { error, session } = await signInWithRetry(email.trim(), password);
        if (error) throw error;
        const stableSession = session ?? await waitForAuthSession();
        const dest = resolveDestination(stableSession?.user?.email ?? email, role);
        toast.success("¡Bienvenido!");
        redirectedRef.current = true;
        navigate(dest, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      let friendly = "No pudimos iniciar sesión. Revisa tus datos.";
      if (isTransientAuthError(err)) {
        friendly = "El servidor de autenticación no responde. Intenta de nuevo en unos segundos.";
        setBackendDown(true);
      } else if (/Invalid login credentials/i.test(msg)) friendly = "Correo o contraseña incorrectos.";
      else if (/Email not confirmed/i.test(msg)) friendly = "Tu email no está confirmado. Revisa tu bandeja.";
      else if (/already registered/i.test(msg)) friendly = "Este correo ya está registrado. Inicia sesión.";
      else if (msg) friendly = msg;
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  const waitForAuthSession = async () => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < AUTH_WAIT_TIMEOUT_MS) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
      } catch (err) {
        console.warn("Session wait retry", err);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return null;
  };

  // Pantalla de sesión detectada (mientras se redirige)
  if (!authLoading && user && !redirectedRef.current) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} />
          Sesión detectada, redirigiendo…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/60 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-heading font-semibold text-foreground">
          {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-6">
            <img src={surteLogo} alt="SURTÉ YA" className="h-14 mb-3 object-contain" />
            <h1 className="font-heading font-bold text-xl text-foreground">
              {isSignUp ? "Crea tu cuenta" : "Bienvenido de nuevo"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isSignUp
                ? "Regístrate para pedir más rápido y guardar tu historial."
                : "Ingresa para administrar tu cuenta y pedidos."}
            </p>
          </div>

          {/* Google primero — flujo recomendado */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60 mb-3"
          >
            {googleLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? "Conectando con Google…" : "Continuar con Google"}
          </button>

          {googleTimedOut && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium mb-1">Google no devolvió la sesión</p>
              <p className="opacity-80 mb-2">
                Si estás dentro de la vista previa embebida, ábrelo en una pestaña nueva.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card border border-amber-300 font-medium hover:bg-amber-100"
                >
                  <ExternalLink size={12} /> Abrir en pestaña nueva
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-2.5 py-1.5 rounded-md bg-amber-200 font-medium hover:bg-amber-300"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-border flex-1" />
            <span className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground">o con correo</span>
            <div className="border-t border-border flex-1" />
          </div>

          {backendDown && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium mb-1">El servidor de autenticación está intermitente</p>
              <p className="opacity-80 mb-2">
                Puede haber un token caducado en este navegador. Limpia la sesión local e intenta de nuevo.
              </p>
              <button
                type="button"
                onClick={clearStaleAuthAndReload}
                className="px-2.5 py-1.5 rounded-md bg-amber-200 font-medium hover:bg-amber-300"
              >
                Limpiar sesión local y recargar
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="WhatsApp (ej: 3001234567)"
                    className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 ml-1">Tipo de negocio</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BUSINESS_TYPES.map((bt) => (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => setBusinessType(bt.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all border ${
                          businessType === bt.value
                            ? "border-accent bg-accent/10 text-foreground font-medium"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        <span>{bt.icon}</span>
                        <span className="truncate">{bt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full bg-muted rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => navigate("/reset-password")}
                  className="text-xs text-accent font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-surte py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              {loading ? "Procesando…" : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </form>

          <button
            onClick={() => setIsSignUp((v) => !v)}
            className="mt-5 text-sm text-muted-foreground w-full text-center"
          >
            {isSignUp ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
            <span className="text-accent font-semibold">
              {isSignUp ? "Inicia sesión" : "Regístrate"}
            </span>
          </button>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck size={12} className="text-secondary" />
            Conexión cifrada · Datos protegidos
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
