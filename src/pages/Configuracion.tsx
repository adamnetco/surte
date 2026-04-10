import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { ArrowLeft, Bell, Moon, Globe, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";
import { useState } from "react";
import { toast } from "sonner";

const Configuracion = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const toggleSetting = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    toast.success(`${key} ${value ? "activado" : "desactivado"}`);
  };

  const settings = [
    { icon: Bell, label: "Notificaciones", desc: "Recibir alertas de pedidos", value: notifications, setter: setNotifications },
    { icon: Moon, label: "Modo oscuro", desc: "Cambiar tema de la app", value: darkMode, setter: setDarkMode },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-heading font-bold text-foreground">Configuración</h1>
        </div>

        <div className="space-y-2">
          {settings.map(({ icon: Icon, label, desc, value, setter }) => (
            <div key={label} className="flex items-center gap-3 bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon size={20} className="text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                onClick={() => toggleSetting(label, !value, setter)}
                className={`w-12 h-7 rounded-full transition-colors relative ${value ? "bg-accent" : "bg-muted"}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-transform ${value ? "right-1" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <h2 className="font-heading font-bold text-base text-foreground mb-2">Información</h2>
          {[
            { icon: Globe, label: "Idioma", value: "Español" },
            { icon: Shield, label: "Versión", value: "1.0.0 MVP" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{label}</p>
              </div>
              <span className="text-sm text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Configuracion;