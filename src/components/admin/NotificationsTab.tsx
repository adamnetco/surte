import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, Users, MessageSquare, Loader2, Smartphone, Radio, AlertTriangle, Clock, History, Calendar, CheckCircle2, XCircle, Hourglass, FileText, RefreshCw, Plus, Minus } from "lucide-react";
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

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: "Pendiente",  cls: "bg-muted text-muted-foreground",          icon: Hourglass },
  running:   { label: "Enviando",   cls: "bg-accent/15 text-accent",                icon: Loader2 },
  completed: { label: "Completado", cls: "bg-secondary/15 text-secondary",          icon: CheckCircle2 },
  failed:    { label: "Fallido",    cls: "bg-destructive/10 text-destructive",      icon: XCircle },
};

const NotificationsTab = ({ queryClient }: { queryClient: any }) => {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [lastResult, setLastResult] = useState<any>(null);

  // Template (HSM) state
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("es");
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-whatsapp-ycloud", {
        body: { action: "list_templates" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTemplates(data?.templates || []);
      toast.success(`${data?.templates?.length || 0} plantilla(s) cargada(s)`);
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar plantillas");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.name === templateName);
  const requiredVarCount = selectedTemplate?.variableCount || 0;

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

  const { data: history } = useQuery({
    queryKey: ["broadcast-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broadcast_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const ycloudReady = !!(settings?.ycloud_api_key && settings?.ycloud_from_number);
  const fromNumberRaw = settings?.ycloud_from_number || "";
  const fromNumberFormatted = fromNumberRaw
    ? (fromNumberRaw.startsWith("+") ? fromNumberRaw : `+${fromNumberRaw.replace(/\D/g, "")}`)
    : "";

  const activeAll = subscribers?.filter((s) => s.is_active) || [];
  const audienceCount = activeAll.filter((s) =>
    segment === "all" ? true :
    segment === "offers" ? s.notify_offers :
    segment === "fresh" ? s.notify_fresh :
    s.notify_new_products
  ).length;

  const broadcast = async (mode: "preview" | "send" | "schedule") => {
    if (!ycloudReady) {
      toast.error("Configura YCloud (API Key + número remitente) en Configuración");
      return;
    }
    if (mode !== "preview" && audienceCount === 0) {
      toast.error("No hay suscriptores activos para este segmento");
      return;
    }
    if (mode === "schedule") {
      if (!scheduleAt) { toast.error("Elige fecha y hora para programar"); return; }
      if (new Date(scheduleAt).getTime() <= Date.now()) { toast.error("La fecha debe ser futura"); return; }
    }

    // Build body depending on template vs text mode
    const body: any = { segment };
    if (useTemplate) {
      if (!templateName.trim()) { toast.error("Selecciona o escribe el nombre de la plantilla"); return; }
      if (templateVars.slice(0, requiredVarCount).some((v) => !v?.trim())) {
        toast.error(`La plantilla requiere ${requiredVarCount} variable(s)`);
        return;
      }
      body.template_name = templateName.trim();
      body.template_language = templateLang.trim() || "es";
      body.template_variables = templateVars.slice(0, requiredVarCount || templateVars.length);
      body.message = `[TEMPLATE:${templateName}]`;
    } else {
      const text = (message || TEMPLATES[segment]).trim();
      if (!text) { toast.error("Escribe un mensaje"); return; }
      body.message = text;
    }

    if (mode === "preview") body.dry_run = true;
    if (mode === "schedule") body.scheduled_at = new Date(scheduleAt).toISOString();

    if (mode === "send" && !confirm(`¿Enviar a ${audienceCount} suscriptor(es) por WhatsApp?\nSegmento: ${SEGMENTS[segment].label}${useTemplate ? `\nPlantilla: ${templateName}` : ""}`)) return;
    if (mode === "schedule" && !confirm(`¿Programar difusión para ${new Date(scheduleAt).toLocaleString("es-CO")}?\nSegmento: ${SEGMENTS[segment].label} · ${audienceCount} suscriptor(es)`)) return;

    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-whatsapp-ycloud", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastResult(data);
      if (mode === "preview") {
        toast.success(`Vista previa: alcanzará a ${data.total} suscriptor(es) (${data.mode})`);
      } else if (mode === "schedule") {
        toast.success(`✓ Programado para ${new Date(data.scheduled_at).toLocaleString("es-CO")}`);
        setScheduleAt("");
        setMessage("");
      } else {
        toast.success(`✓ Enviados: ${data.sent} · Fallidos: ${data.failed}`);
        if (data.failed > 0) toast.warning(`${data.failed} mensaje(s) no pudieron enviarse`);
        setMessage("");
      }
      queryClient.invalidateQueries({ queryKey: ["broadcast-logs"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar la difusión");
    } finally {
      setSending(false);
    }
  };

  const cancelScheduled = async (id: string) => {
    if (!confirm("¿Cancelar esta difusión programada?")) return;
    const { error } = await supabase.from("broadcast_logs").update({ status: "failed", errors: [{ phone: "system", error: "Cancelado por el administrador" }] }).eq("id", id).eq("status", "pending");
    if (error) { toast.error(error.message); return; }
    toast.success("Difusión cancelada");
    queryClient.invalidateQueries({ queryKey: ["broadcast-logs"] });
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

      {/* Diagnostic panel */}
      <div className={`rounded-xl p-3 border ${ycloudReady ? "bg-secondary/5 border-secondary/30" : "bg-destructive/10 border-destructive/30"}`}>
        <div className="flex items-start gap-2">
          {ycloudReady ? <CheckCircle2 size={16} className="text-secondary shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />}
          <div className="text-xs flex-1">
            <p className={`font-semibold ${ycloudReady ? "text-secondary" : "text-destructive"}`}>
              {ycloudReady ? "YCloud listo para enviar" : "YCloud no está configurado"}
            </p>
            {ycloudReady ? (
              <p className="text-muted-foreground mt-0.5">Remitente: <span className="font-mono">{fromNumberFormatted}</span></p>
            ) : (
              <p className="text-muted-foreground mt-0.5">Ve a <span className="font-semibold">Configuración → Integraciones</span> y añade <code className="font-mono">ycloud_api_key</code> y <code className="font-mono">ycloud_from_number</code>.</p>
            )}
          </div>
        </div>
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

        {/* Mode toggle: text vs HSM template */}
        <div className="flex items-center justify-between bg-muted/40 rounded-lg p-2.5 border border-border">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-accent" />
            <div>
              <p className="text-xs font-semibold text-foreground">Plantilla HSM aprobada</p>
              <p className="text-[10px] text-muted-foreground">Necesario para iniciar conversación &gt;24h</p>
            </div>
          </div>
          <Switch checked={useTemplate} onCheckedChange={(v) => { setUseTemplate(v); if (v && templates.length === 0) loadTemplates(); }} />
        </div>

        {useTemplate ? (
          <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-primary">Plantilla WhatsApp</p>
              <button
                type="button"
                onClick={loadTemplates}
                disabled={loadingTemplates}
                className="text-[10px] text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {loadingTemplates ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                {templates.length > 0 ? `Recargar (${templates.length})` : "Cargar plantillas"}
              </button>
            </div>
            {templates.length > 0 ? (
              <select
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  const tpl = templates.find((t) => t.name === e.target.value);
                  if (tpl) {
                    setTemplateLang(tpl.language || "es");
                    setTemplateVars(Array(tpl.variableCount || 0).fill(""));
                  }
                }}
                className="w-full bg-card rounded-lg px-2 py-2 text-xs border border-border focus:border-primary focus:outline-none"
              >
                <option value="">— Selecciona una plantilla —</option>
                {templates.map((t) => (
                  <option key={`${t.name}_${t.language}`} value={t.name}>
                    {t.name} ({t.language}) — {t.status} · {t.variableCount} var
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nombre exacto de la plantilla (ej: order_update)"
                className="w-full bg-card rounded-lg px-2 py-2 text-xs border border-border focus:border-primary focus:outline-none font-mono"
              />
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-[10px] text-muted-foreground">Idioma</label>
                <input
                  type="text"
                  value={templateLang}
                  onChange={(e) => setTemplateLang(e.target.value)}
                  placeholder="es"
                  className="w-full bg-card rounded-lg px-2 py-1.5 text-xs border border-border focus:border-primary focus:outline-none font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground">Variables ({requiredVarCount || templateVars.length})</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setTemplateVars((v) => [...v, ""])} className="bg-card border border-border rounded px-1.5 py-1 text-[10px] hover:bg-muted">
                    <Plus size={10} />
                  </button>
                  <button type="button" onClick={() => setTemplateVars((v) => v.slice(0, -1))} disabled={templateVars.length === 0} className="bg-card border border-border rounded px-1.5 py-1 text-[10px] hover:bg-muted disabled:opacity-30">
                    <Minus size={10} />
                  </button>
                </div>
              </div>
            </div>
            {selectedTemplate?.body && (
              <div className="bg-card rounded p-2 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Cuerpo de la plantilla:</p>
                <p className="text-[11px] text-foreground whitespace-pre-wrap font-mono">{selectedTemplate.body}</p>
              </div>
            )}
            {(requiredVarCount > 0 || templateVars.length > 0) && (
              <div className="space-y-1">
                {Array.from({ length: Math.max(requiredVarCount, templateVars.length) }).map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono w-8">{`{{${i + 1}}}`}</span>
                    <input
                      type="text"
                      value={templateVars[i] || ""}
                      onChange={(e) => setTemplateVars((v) => { const next = [...v]; next[i] = e.target.value; return next; })}
                      placeholder={`Valor para variable ${i + 1}`}
                      className="flex-1 bg-card rounded px-2 py-1 text-xs border border-border focus:border-primary focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* Schedule selector */}
        <div className="bg-muted/40 rounded-lg p-2.5 border border-border">
          <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
            <Calendar size={12} /> Programar (opcional)
          </label>
          <input
            type="datetime-local"
            value={scheduleAt}
            min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="w-full bg-card rounded-lg px-2 py-1.5 text-xs border border-transparent focus:border-accent focus:outline-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1">El cron ejecuta difusiones pendientes cada 5 min.</p>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-muted-foreground">
            Audiencia: <span className="font-semibold text-accent">{audienceCount}</span> de {activeAll.length} suscriptor(es)
          </p>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => broadcast("preview")}
              disabled={sending}
              className="text-xs px-3 py-2 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              Vista previa
            </button>
            {scheduleAt ? (
              <button
                onClick={() => broadcast("schedule")}
                disabled={sending || !ycloudReady || audienceCount === 0}
                className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                Programar
              </button>
            ) : (
              <button
                onClick={() => broadcast("send")}
                disabled={sending || !ycloudReady || audienceCount === 0}
                className="btn-surte text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Enviar ahora
              </button>
            )}
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

      {/* History */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <History size={14} className="text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial ({history?.length || 0})</p>
        </div>
        {(!history || history.length === 0) && (
          <div className="text-center py-6 text-muted-foreground bg-card rounded-xl border border-border">
            <History size={28} strokeWidth={1.2} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Aún no hay difusiones registradas</p>
          </div>
        )}
        {history?.map((log: any) => {
          const meta = STATUS_META[log.status] || STATUS_META.completed;
          const Icon = meta.icon;
          const isPending = log.status === "pending";
          return (
            <div key={log.id} className="bg-card rounded-xl p-3 border border-border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${meta.cls}`}>
                    <Icon size={10} className={log.status === "running" ? "animate-spin" : ""} />
                    {meta.label}
                  </span>
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {SEGMENTS[log.segment as Segment]?.emoji} {SEGMENTS[log.segment as Segment]?.label || log.segment}
                  </span>
                </div>
                {isPending && (
                  <button onClick={() => cancelScheduled(log.id)} className="text-[10px] text-destructive hover:underline">Cancelar</button>
                )}
              </div>
              <p className="text-xs text-foreground line-clamp-2">{log.message}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                {log.scheduled_at && (
                  <span className="flex items-center gap-1"><Calendar size={10} />Programado: {new Date(log.scheduled_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</span>
                )}
                {log.sent_at && (
                  <span className="flex items-center gap-1"><CheckCircle2 size={10} />Enviado: {new Date(log.sent_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</span>
                )}
                {!log.scheduled_at && !log.sent_at && (
                  <span>Creado: {new Date(log.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</span>
                )}
              </div>
              {(log.total > 0 || log.sent > 0 || log.failed > 0) && (
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className="text-center bg-muted/50 rounded py-1">
                    <p className="font-bold text-foreground text-xs">{log.total}</p>
                    <p className="text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center bg-secondary/10 rounded py-1">
                    <p className="font-bold text-secondary text-xs">{log.sent}</p>
                    <p className="text-muted-foreground">Enviados</p>
                  </div>
                  <div className="text-center bg-destructive/10 rounded py-1">
                    <p className="font-bold text-destructive text-xs">{log.failed}</p>
                    <p className="text-muted-foreground">Fallidos</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
