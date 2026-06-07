import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import PushOptIn from "@/components/PushOptIn";
import { ArrowLeft, Bell, Globe, Shield, Sun, Moon, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/context/ThemeContext";

const Configuracion = () => {
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <SeoBreadcrumbs items={[{ label: "Configuración" }]} className="mb-2" />
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-heading font-bold text-foreground">Configuración</h1>
        </div>

        {/* Notifications */}
        <div className="space-y-2 mb-6">
          <PushOptIn />
        </div>

        {/* Theme selector — synced with global ThemeContext */}
        <div className="mb-6">
          <h2 className="font-heading font-bold text-base text-foreground mb-2">Apariencia</h2>
          <div className="bg-card rounded-xl p-2 border border-border grid grid-cols-3 gap-1">
            {[
              { key: "light", label: "Claro", icon: Sun },
              { key: "dark", label: "Oscuro", icon: Moon },
              { key: "system", label: "Sistema", icon: Monitor },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setPreference(key as any); toast.success(`Tema: ${label}`); }}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-colors ${
                  preference === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
            También puedes alternar el tema rápidamente desde el botón en la barra superior.
          </p>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h2 className="font-heading font-bold text-base text-foreground mb-2">Información</h2>
          {[
            { icon: Globe, label: "Idioma", value: "Español" },
            { icon: Shield, label: "Versión", value: "1.0.0 MVP" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 bg-card rounded-xl p-4 border border-border">
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
