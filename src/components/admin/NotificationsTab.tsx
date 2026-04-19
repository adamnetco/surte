import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, Users, MessageSquare, Loader2, Smartphone, Radio, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Segment = "all" | "offers" | "fresh" | "new_products";

const SEGMENTS: Record<Segment, { label: string; emoji: string }> = {
  all: { label: "Todos", emoji: "📣" },
  offers: { label: "Ofertas", emoji: "🔥" },
  fresh: { label: "Frescos", emoji: "🌿" },
  new_products: { label: "Nuevos", emoji: "✨" },
};

const TEMPLATES: Record<Segment, string> = {
  all: "Hola desde SURTÉ YA. Tenemos novedades que te interesarán. Visítanos en nuestra app.",
  offers: "SURTÉ YA - Nuevas ofertas disponibles. Descuentos hasta del 30% en cárnicos y salsas. Pide ya antes que se agoten.",
  fresh: "SURTÉ YA - Llegaron productos frescos del día. Pulpas y cárnicos recién procesados. Reserva el tuyo.",
  new_products: "SURTÉ YA - Hemos añadido nuevos productos al catálogo. Entra y descubre las novedades.",
};

const NotificationsTab = ({ queryClient }: { queryClient: any }) => {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: subscribers } = useQuery({
    queryKey: ["admin-notification-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["app_settings_notif"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ycloud_api_key", "ycloud_from_number"]);
      if (error) throw error;
      const s: Record<string, string> = {};
      data.forEach((r: any) => { s[r.key] = r.value; });
      return s;
    },
  });

  const ycloudReady = !!(settings?.ycloud_api_key && settings?.ycloud_from_number);

  const activeAll = subscribers?.filter((s) => s.is_active) || [];
  const audienceCount = activeAll.filter((s) =>
    segment === "all" ? true :
    segment === "offers" ? s.notify_offers :
    segment === "fresh" ? s.notify_fresh :
    s.notify_new_products
  ).length;

  const broadcast = async (dryRun = false) => {
    const text = (message || TEMPLATES[segment]).trim();
    if (!text) { toast.error("Escribe un mensaje"); return; }
    if (!ycloudReady) {
      toast.error("Configura YCloud (API Key + número remitente) en Configuración");
      return;
    }
    if (audienceCount === 0 && !dryRun) {
      toast.error("No hay suscriptores activos para este segmento");
      return;
    }
    if (!dryRun && !confirm(`¿Enviar a ${audienceCount} suscriptor(es) por WhatsApp?\nSegmento: ${SEGMENTS[segment].label}`)) return;

    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-whatsapp-ycloud", {
        body: { message: text, segment, dry_run: dryRun },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastResult(data);
      if (dryRun) {
        toast.success(`Vista previa: alcanzará a ${data.total} suscriptor(es)`);
      } else {
        toast.success(`✓ Enviados: ${data.sent} · Fallidos: ${data.failed}`);
        if (data.failed > 0) toast.warning(`${data.failed} mensaje(s) no pudieron enviarse`);
        setMessage("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar la difusión");
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
        <h2 className="font-heading font-bold text-lg text-foreground">Notificaciones WhatsApp</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <Users size={20} className="mx-auto text-accent mb-1" />
          <p className="text-2xl font-heading font-bold text-foreground">{activeAll.length}</p>
          <p className="text-[11px] text-muted-foreground">Suscriptores activos</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <Smartphone size={20} className="mx-auto text-accent mb-1" />
          <p className="text-2xl font-heading font-bold text-foreground">{subscribers?.length || 0}</p>
          <p className="text-[11px] text-muted-foreground">Total registrados</p>
        </div>
      </div>

      {/* YCloud not configured warning */}
      {!ycloudReady && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl p-3">
          <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-destructive">YCloud no está configurado</p>
            <p className="text-muted-foreground mt-0.5">Ve a <span className="font-semibold">Configuración → Integraciones</span> y añade la API Key y el número remitente para habilitar la difusión masiva.</p>
          </div>
        </div>
      )}

      {/* Broadcast composer */}
      <div className="bg-card rounded-xl p-4 border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-accent" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difusión Masiva (YCloud)</p>
        </div>

        {/* Segment selector */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {(Object.entries(SEGMENTS) as [Segment, typeof SEGMENTS[Segment]][]).map(([key, { label, emoji }]) => (
            <button
              key={key}
              onClick={() => { setSegment(key); if (!message) setMessage(TEMPLATES[key]); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${segment === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {emoji} {label}
            </button>
          ))}
        </div>

        <textarea
          value={message || TEMPLATES[segment]}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe tu mensaje..."
          maxLength={1000}
          className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors resize-none"
          rows={4}
        />
        <p className="text-[10px] text-muted-foreground text-right">
          {(message || TEMPLATES[segment]).length}/1000
        </p>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-muted-foreground">
            Audiencia: <span className="font-semibold text-accent">{audienceCount}</span> de {activeAll.length} suscriptor(es)
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => broadcast(true)}
              disabled={sending}
              className="text-xs px-3 py-2 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              Vista previa
            </button>
            <button
              onClick={() => broadcast(false)}
              disabled={sending || !ycloudReady || audienceCount === 0}
              className="btn-surte text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar
            </button>
          </div>
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="bg-muted/50 rounded-lg p-2.5 border border-border">
            <p className="text-[11px] font-semibold text-foreground">Último envío</p>
            <div className="grid grid-cols-3 gap-2 mt-1.5 text-[11px]">
              <div className="text-center bg-card rounded p-1.5">
                <p className="text-base font-heading font-bold text-foreground">{lastResult.total ?? 0}</p>
                <p className="text-muted-foreground text-[10px]">Total</p>
              </div>
              <div className="text-center bg-secondary/10 rounded p-1.5">
                <p className="text-base font-heading font-bold text-secondary">{lastResult.sent ?? 0}</p>
                <p className="text-muted-foreground text-[10px]">Enviados</p>
              </div>
              <div className="text-center bg-destructive/10 rounded p-1.5">
                <p className="text-base font-heading font-bold text-destructive">{lastResult.failed ?? 0}</p>
                <p className="text-muted-foreground text-[10px]">Fallidos</p>
              </div>
            </div>
            {lastResult.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="text-[10px] text-destructive cursor-pointer">Ver errores ({lastResult.errors.length})</summary>
                <ul className="mt-1 space-y-0.5">
                  {lastResult.errors.map((e: any, i: number) => (
                    <li key={i} className="text-[10px] text-muted-foreground font-mono truncate">
                      {e.phone}: {e.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
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
