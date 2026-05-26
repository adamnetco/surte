import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Store, ArrowRight, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import HeadMeta from "@/components/seo/HeadMeta";

/**
 * Portal de acceso público de SistecPOS (sistecpos.com / app.sistecpos.com).
 * Reemplaza al antiguo `/` que servía la tienda Surteya.
 * - Soy administrador → /admin/login
 * - Soy cajero / cliente → /user/login
 * Si ya hay sesión activa, redirige automáticamente al destino por rol.
 */
const LoginRouter = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (role === "superadmin" || role === "admin") {
      navigate("/admin", { replace: true });
    } else if (role === "agente") {
      navigate("/pos", { replace: true });
    } else {
      navigate("/clientes", { replace: true });
    }
  }, [loading, user, role, navigate]);

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      <HeadMeta
        title="SistecPOS · Acceso al sistema"
        description="Portal de acceso para administradores, cajeros y clientes del ecosistema SistecPOS."
      />

      <header className="px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <span className="font-heading font-bold tracking-tight">SistecPOS</span>
        </div>
        <a
          href="https://sistecpos.com"
          className="text-xs text-white/60 hover:text-white transition-colors"
        >
          sistecpos.com
        </a>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-6xl w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3 tracking-tight">
            Bienvenido a SistecPOS
          </h1>
          <p className="text-white/60 text-sm md:text-base max-w-md mx-auto">
            Elige cómo quieres ingresar al sistema
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ y: -2 }}
            onClick={() => navigate("/admin/login")}
            className="group text-left p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
              <ShieldCheck className="text-primary" size={24} />
            </div>
            <h2 className="font-heading font-bold text-lg mb-1">Soy Administrador</h2>
            <p className="text-white/60 text-sm mb-4">
              Panel de control, inventario, reportes y gestión multi-tenant.
            </p>
            <span className="inline-flex items-center gap-1 text-primary text-sm font-medium">
              Entrar al panel <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            whileHover={{ y: -2 }}
            onClick={() => navigate("/user/login")}
            className="group text-left p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/30 transition-colors">
              <Store className="text-accent" size={24} />
            </div>
            <h2 className="font-heading font-bold text-lg mb-1">Soy Cajero / Cliente</h2>
            <p className="text-white/60 text-sm mb-4">
              Punto de venta, mis pedidos, facturación electrónica.
            </p>
            <span className="inline-flex items-center gap-1 text-accent text-sm font-medium">
              Iniciar sesión <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>
        </div>

        <p className="mt-10 text-xs text-white/40 text-center max-w-md">
          ¿Buscas una tienda específica? Visita{" "}
          <a href="https://surteya.sistecpos.com" className="text-white/70 hover:text-white underline">
            surteya.sistecpos.com
          </a>{" "}
          o{" "}
          <a href="/surteya" className="text-white/70 hover:text-white underline">
            /surteya
          </a>
          .
        </p>
      </section>

      <footer className="px-6 py-4 text-center text-xs text-white/30">
        © {new Date().getFullYear()} SistecPOS · Multi-tenant POS para Colombia
      </footer>
    </main>
  );
};

export default LoginRouter;
