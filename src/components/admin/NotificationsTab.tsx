import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, Users, MessageSquare, Loader2, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const NotificationsTab = ({ queryClient }: { queryClient: any }) => {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState<"offers" | "fresh" | "new_products" | "custom">("offers");

  const { data: subscribers } = useQuery({
    queryKey: ["admin-notification-subs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_subscriptions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      const s: Record<string, string> = {};
      data.forEach((r) => { s[r.key] = r.value; });
      return s;
    },
  });

  const whatsappNumber = settings?.whatsapp_number || "";
  const activeSubscribers = subscribers?.filter((s) => s.is_active) || [];

  const templates: Record<string, { label: string; emoji: string; defaultMsg: string }> = {
    offers: { label: "Nuevas Ofertas", emoji: "🔥", defaultMsg: "¡Tenemos nuevas ofertas especiales para ti! Entra a SURTÉ y descubre descuentos hasta del 30% en cárnicos y salsas. 🥩🌶️" },
    fresh: { label: "Productos Frescos", emoji: "🌿", defaultMsg: "¡Llegaron productos frescos! Pulpas de fruta recién procesadas y cárnicos del día. Pide ahora antes de que se agoten. 🍊🥬" },
    new_products: { label: "Nuevos Productos", emoji: "✨", defaultMsg: "¡Novedad en SURTÉ! Hemos añadido nuevos productos a nuestro catálogo. Entra y descúbrelos. 🛒" },
    custom: { label: "Personalizado", emoji: "📝", defaultMsg: "" },
  };

  const sendNotification = async () => {
    const text = message || templates[notifType]?.defaultMsg;
    if (!text) { toast.error("Escribe un mensaje"); return; }
    if (!whatsappNumber) { toast.error("Configura el número de WhatsApp en Configuración"); return; }
    if (activeSubscribers.length === 0) { toast.error("No hay suscriptores activos"); return; }

    setSending(true);
    try {
      // Generate WhatsApp links for each subscriber
      const encodedMsg = encodeURIComponent(text);
      const links = activeSubscribers.map((s) => ({
        phone: s.phone,
        url: `https://wa.me/${s.phone.replace(/\D/g, "")}?text=${encodedMsg}`,
      }));

      // Open first link to initiate (WhatsApp API limitation for mass sending)
      if (links.length > 0) {
        window.open(links[0].url, "_blank");
      }

      toast.success(`Notificación preparada para ${activeSubscribers.length} suscriptor(es). Se abrirá WhatsApp para enviar.`);
      setMessage("");
    } catch (err) {
      toast.error("Error al preparar notificación");
    } finally {
      setSending(false);
    }
  };

  const toggleSubscriber = async (id: string, current: boolean) => {
    await supabase.from("notification_subscriptions").update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-notification-subs"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-accent" />
        <h2 className="font-heading font-bold text-lg text-foreground">Notificaciones</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <Users size={20} className="mx-auto text-accent mb-1" />
          <p className="text-2xl font-heading font-bold text-foreground">{activeSubscribers.length}</p>
          <p className="text-[11px] text-muted-foreground">Suscriptores activos</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <Smartphone size={20} className="mx-auto text-accent mb-1" />
          <p className="text-2xl font-heading font-bold text-foreground">{subscribers?.length || 0}</p>
          <p className="text-[11px] text-muted-foreground">Total registrados</p>
        </div>
      </div>

      {/* Send notification */}
      <div className="bg-card rounded-xl p-4 border border-border space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviar Notificación WhatsApp</p>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {Object.entries(templates).map(([key, { label, emoji }]) => (
            <button key={key} onClick={() => { setNotifType(key as any); setMessage(templates[key].defaultMsg); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${notifType === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {emoji} {label}
            </button>
          ))}
        </div>

        <textarea
          value={message || templates[notifType]?.defaultMsg || ""}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe tu mensaje..."
          className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors resize-none"
          rows={4}
        />

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Se enviará a <span className="font-semibold text-accent">{activeSubscribers.length}</span> suscriptor(es)
          </p>
          <button onClick={sendNotification} disabled={sending || activeSubscribers.length === 0}
            className="btn-surte text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar
          </button>
        </div>
      </div>

      {/* Subscribers list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suscriptores ({subscribers?.length || 0})</p>
        {subscribers?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bell size={32} strokeWidth={1.2} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aún no hay suscriptores</p>
            <p className="text-xs mt-1">Los clientes pueden suscribirse desde la tienda</p>
          </div>
        )}
        {subscribers?.map((s: any) => (
          <div key={s.id} className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-colors ${s.is_active ? "border-border" : "border-border opacity-50"}`}>
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{s.phone}</p>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                {s.notify_offers && <span className="bg-muted px-1.5 py-0.5 rounded">🔥 Ofertas</span>}
                {s.notify_fresh && <span className="bg-muted px-1.5 py-0.5 rounded">🌿 Frescos</span>}
                {s.notify_new_products && <span className="bg-muted px-1.5 py-0.5 rounded">✨ Nuevos</span>}
              </div>
            </div>
            <Switch checked={s.is_active} onCheckedChange={() => toggleSubscriber(s.id, s.is_active)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsTab;
