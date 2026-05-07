import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isPushSupported, getCurrentPermission, subscribeToPush, unsubscribeFromPush } from "@/lib/pushClient";

interface Props {
  variant?: "inline" | "card";
  className?: string;
}

const PushOptIn = ({ variant = "card", className = "" }: Props) => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await isPushSupported();
      setSupported(ok);
      setPermission(await getCurrentPermission());
    })();
  }, []);

  if (supported === null) return null;
  if (!supported) return null;

  const handleSubscribe = async () => {
    setBusy(true);
    const r = await subscribeToPush();
    setBusy(false);
    if (r.ok) {
      toast.success("¡Listo! Recibirás novedades de SURTÉ YA");
      setPermission("granted");
    } else {
      toast.error(r.error || "No se pudo activar");
    }
  };

  const handleUnsubscribe = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    toast.success("Notificaciones desactivadas");
    setPermission(await getCurrentPermission());
  };

  const isOn = permission === "granted";

  if (variant === "inline") {
    return (
      <button
        onClick={isOn ? handleUnsubscribe : handleSubscribe}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : isOn ? <BellOff size={14} /> : <Bell size={14} />}
        {isOn ? "Desactivar alertas" : "Activar alertas"}
      </button>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-2xl p-4 flex items-center gap-3 ${className}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOn ? "bg-secondary/15 text-secondary" : "bg-accent/10 text-accent"}`}>
        {isOn ? <BellOff size={18} /> : <Bell size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground">
          {isOn ? "Alertas activas" : "Recibe ofertas y novedades"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isOn ? "Te avisaremos de nuevos productos y ofertas." : "Activa notificaciones en tu navegador o app."}
        </p>
      </div>
      <button
        onClick={isOn ? handleUnsubscribe : handleSubscribe}
        disabled={busy}
        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
          isOn ? "bg-muted text-foreground" : "bg-accent text-accent-foreground"
        }`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : isOn ? "Desactivar" : "Activar"}
      </button>
    </div>
  );
};

export default PushOptIn;
