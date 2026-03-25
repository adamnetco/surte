import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Phone } from "lucide-react";
import { toast } from "sonner";
import surteLogo from "@/assets/surte-logo.png";

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
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar con Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, businessType, phone);
        if (error) throw error;
        toast.success("¡Cuenta creada! Revisa tu email para confirmar.");
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("¡Bienvenido!");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de autenticación");
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
          {isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <img src={surteLogo} alt="SURTÉ" className="h-16 mb-6 object-contain" />

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full bg-muted rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-surte py-3.5 text-sm disabled:opacity-50"
          >
            {loading ? "Cargando..." : isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}
          </button>
        </form>

        <div className="w-full max-w-sm mt-4">
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-border flex-1" />
            <span className="px-3 text-xs text-muted-foreground">o continúa con</span>
            <div className="border-t border-border flex-1" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Conectando..." : "Google"}
          </button>
        </div>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-6 text-sm text-muted-foreground"
        >
          {isSignUp ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <span className="text-accent font-medium">
            {isSignUp ? "Inicia Sesión" : "Regístrate"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default Login;
