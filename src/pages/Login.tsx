import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
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
