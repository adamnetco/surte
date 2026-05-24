import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import surteLogo from "@/assets/surte-logo.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const prepareRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const type = hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (type !== "recovery" && !accessToken) {
        setCheckingRecovery(false);
        return;
      }

      setStep("update");
      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          window.history.replaceState(null, "", `${window.location.origin}/reset-password`);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("El enlace no trajo una sesión válida.");
        if (!cancelled) setRecoveryReady(true);
      } catch (err: any) {
        if (!cancelled) setRecoveryError(err?.message || "El enlace de recuperación expiró o no es válido.");
      } finally {
        if (!cancelled) setCheckingRecovery(false);
      }
    };

    void prepareRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      setSent(true);
      toast.success("Te enviamos un correo con el enlace de recuperación");
    } catch (err: any) {
      toast.error(err.message || "Error al enviar correo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Auth session missing!");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("¡Contraseña actualizada exitosamente!");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft size={22} />
        </button>
        <span className="font-heading font-semibold text-foreground">
          {step === "request" ? "Recuperar Contraseña" : "Nueva Contraseña"}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <img src={surteLogo} alt="SURTÉ" className="h-16 mb-6 object-contain" />

        {step === "request" && !sent && (
          <form onSubmit={handleRequestReset} className="w-full max-w-sm space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-2">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-surte py-3.5 text-sm disabled:opacity-50">
              {loading ? "Enviando..." : "Enviar enlace de recuperación"}
            </button>
          </form>
        )}

        {step === "request" && sent && (
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-secondary/10 rounded-full p-4">
                <CheckCircle2 size={32} className="text-secondary" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground">¡Correo enviado!</h2>
            <p className="text-sm text-muted-foreground">
              Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue el enlace para restablecer tu contraseña.
            </p>
            <button onClick={() => navigate("/login")} className="text-sm text-accent font-medium">
              Volver a Iniciar Sesión
            </button>
          </div>
        )}

        {step === "update" && (
          <form onSubmit={handleUpdatePassword} className="w-full max-w-sm space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-2">
              Ingresa tu nueva contraseña.
            </p>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="w-full bg-muted rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar contraseña"
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-surte py-3.5 text-sm disabled:opacity-50">
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
