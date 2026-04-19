import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Save, Eye, EyeOff, DollarSign, Phone, Store, Palette, RotateCcw,
  Upload, Loader2, Image as ImageIcon, Link2, Award, MessageSquare,
  CheckCircle2, Send, Wifi, WifiOff,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useImageUpload } from "@/hooks/useImageUpload";

const DEFAULT_COLORS: Record<string, { hex: string; label: string; desc: string }> = {
  color_primary: { hex: "#0C4B83", label: "Azul Confianza", desc: "Headers, navegación" },
  color_secondary: { hex: "#76B833", label: "Verde Vitalidad", desc: "Frescura y productos naturales" },
  color_accent: { hex: "#F37021", label: "Naranja Energía", desc: "CTA, promociones" },
  color_tierra: { hex: "#8D6E63", label: "Tierra Santandereana", desc: "Fondos cálidos" },
  color_cream: { hex: "#F0F0F0", label: "Cloud Dancer", desc: "Fondo limpio" },
};

type SettingMeta = { label: string; icon: typeof Save; type: "text" | "toggle"; group: string; description?: string };

const settingsMeta: Record<string, SettingMeta> = {
  store_name: { label: "Nombre de la Tienda", icon: Store, type: "text", group: "general" },
  whatsapp_number: { label: "Número WhatsApp", icon: Phone, type: "text", group: "general", description: "Con código de país: 573001234567" },
  min_order_amount: { label: "Pedido Mínimo (COP)", icon: DollarSign, type: "text", group: "general", description: "Monto mínimo para realizar un pedido" },
  estimated_delivery_days: { label: "Tiempo de Entrega", icon: Save, type: "text", group: "general", description: "Ej: 1-2, 24h, Mismo día. Se muestra al cliente en el checkout" },
  footer_text: { label: "Texto Legal", icon: Save, type: "text", group: "legal" },
  footer_nit: { label: "NIT Empresa", icon: Save, type: "text", group: "legal" },
  footer_email: { label: "Email de Contacto", icon: Save, type: "text", group: "legal" },
  footer_address: { label: "Dirección Física", icon: Save, type: "text", group: "legal" },
  google_maps_url: { label: "Google Maps URL", icon: Link2, type: "text", group: "legal", description: "Enlace de Google Mi Negocio (share link)" },
  google_maps_embed: { label: "Google Maps Embed URL", icon: Link2, type: "text", group: "legal", description: "URL de embed del mapa (src del iframe)" },
  social_facebook: { label: "Facebook URL", icon: Link2, type: "text", group: "redes", description: "https://facebook.com/..." },
  social_instagram: { label: "Instagram URL", icon: Link2, type: "text", group: "redes", description: "https://instagram.com/..." },
  social_tiktok: { label: "TikTok URL", icon: Link2, type: "text", group: "redes", description: "https://tiktok.com/@..." },
  external_sync_webhook_url: { label: "Webhook Sync Externa", icon: Link2, type: "text", group: "integraciones", description: "URL para enviar pedidos" },
  ycloud_api_key: { label: "YCloud API Key", icon: MessageSquare, type: "text", group: "integraciones", description: "API Key de YCloud para WhatsApp Business" },
  ycloud_from_number: { label: "YCloud Número Remitente", icon: Phone, type: "text", group: "integraciones", description: "Número de WhatsApp Business en YCloud" },
  callmebot_api_key: { label: "CallMeBot API Key", icon: MessageSquare, type: "text", group: "integraciones", description: "API Key de CallMeBot para notificaciones WhatsApp" },
  callmebot_phone: { label: "CallMeBot Teléfono", icon: Phone, type: "text", group: "integraciones", description: "Número para recibir notificaciones CallMeBot (con código de país)" },
  trust_badge_1_label: { label: "Badge 1 — Título", icon: Award, type: "text", group: "badges" },
  trust_badge_1_sub: { label: "Badge 1 — Subtítulo", icon: Award, type: "text", group: "badges" },
  trust_badge_2_label: { label: "Badge 2 — Título", icon: Award, type: "text", group: "badges" },
  trust_badge_2_sub: { label: "Badge 2 — Subtítulo", icon: Award, type: "text", group: "badges" },
  trust_badge_3_label: { label: "Badge 3 — Título", icon: Award, type: "text", group: "badges" },
  trust_badge_3_sub: { label: "Badge 3 — Subtítulo", icon: Award, type: "text", group: "badges" },
  show_price_tiers: { label: "Precios Escalonados", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_offers: { label: "Sección de Ofertas", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_testimonials: { label: "Sección de Testimonios", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_gallery: { label: "Sección de Galería", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_brands: { label: "Marcas Aliadas", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_promo: { label: "Sección Promocional", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_banners: { label: "Carrusel de Banners", icon: Eye, type: "toggle", group: "visibilidad" },
  show_section_featured: { label: "Sección Destacados", icon: Eye, type: "toggle", group: "visibilidad", description: "Pestañas de productos destacados en la página de inicio" },
  show_promo_banner: { label: "Barra Superior Promocional", icon: Eye, type: "toggle", group: "visibilidad" },
  promo_banner_text: { label: "Texto Barra Promocional", icon: MessageSquare, type: "text", group: "general", description: "Ej: 🚚 ENVÍO GRATIS EN COMPRAS DESDE $120.000" },
  featured_label_ofertas: { label: "Etiqueta Destacados: Ofertas", icon: Award, type: "text", group: "destacados", description: "Ej: 🔥 Ofertas" },
  featured_label_mayorista: { label: "Etiqueta Destacados: Mayorista", icon: Award, type: "text", group: "destacados", description: "Ej: 💰 Mayorista" },
  featured_label_frescos: { label: "Etiqueta Destacados: Frescos", icon: Award, type: "text", group: "destacados", description: "Ej: 🌿 Frescos" },
  checkout_show_delivery_date: { label: "Mostrar fecha de entrega", icon: Eye, type: "toggle", group: "checkout", description: "Permite al cliente elegir fecha preferida" },
  checkout_show_time_slot: { label: "Mostrar jornada (mañana/tarde)", icon: Eye, type: "toggle", group: "checkout", description: "Selector de horario preferido" },
  checkout_show_payment_method: { label: "Mostrar método de pago", icon: Eye, type: "toggle", group: "checkout", description: "Efectivo / Transferencia" },
  checkout_show_geolocation: { label: "Mostrar geolocalización", icon: Eye, type: "toggle", group: "checkout", description: "Permite capturar coordenadas GPS" },
};

const GROUP_LABELS: Record<string, string> = {
  general: "🏪 General",
  legal: "📄 Datos Legales & Mapa",
  redes: "📱 Redes Sociales",
  integraciones: "🔗 Integraciones",
  badges: "🏅 Trust Badges",
  visibilidad: "👁️ Visibilidad de Secciones",
  destacados: "⭐ Etiquetas Destacados",
  checkout: "🛒 Checkout — Campos Visibles",
};

const SettingsTab = ({ settings, queryClient }: { settings: any[]; queryClient: any }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { upload, uploading } = useImageUpload();
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("🧪 Mensaje de prueba desde SURTÉ YA — ¡YCloud funciona correctamente!");
  const [sendingTest, setSendingTest] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const sendTestWhatsApp = async () => {
    if (!testPhone.trim()) { toast.error("Ingresa un número de teléfono"); return; }
    const apiKey = values.ycloud_api_key;
    const fromNumber = values.ycloud_from_number;
    if (!apiKey || !fromNumber) {
      toast.error("Configura primero la API Key y número remitente de YCloud, y guarda los cambios");
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-ycloud-whatsapp", {
        body: { action: "send_text", to: testPhone.trim(), message: testMessage },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("✅ Mensaje enviado correctamente");
    } catch (err: any) {
      toast.error(err.message || "Error enviando mensaje de prueba");
    } finally {
      setSendingTest(false);
    }
  };

  const checkYCloudBalance = async () => {
    setCheckingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-ycloud-whatsapp", {
        body: { action: "check_balance" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const amt = data?.balance ?? data?.amount ?? JSON.stringify(data);
      setBalance(String(amt));
      toast.success("Balance consultado");
    } catch (err: any) {
      toast.error(err.message || "Error consultando balance");
    } finally {
      setCheckingBalance(false);
    }
  };

  useEffect(() => {
    if (settings) {
      const v: Record<string, string> = {};
      settings.forEach((s: any) => { v[s.key] = s.value; });
      setValues(v);
      setDirty(new Set());
    }
  }, [settings]);

  const updateValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setDirty((prev) => new Set(prev).add(key));
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    const existing = settings?.find((s: any) => s.key === key);
    if (existing) {
      const { error } = await supabase.from("app_settings").update({ value }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("app_settings").insert({ key, value });
      if (error) throw error;
    }
  };

  const saveAll = async () => {
    if (dirty.size === 0) { toast.info("No hay cambios pendientes"); return; }
    setSaving(true);
    try {
      const promises = Array.from(dirty).map((key) => upsertSetting(key, values[key] || ""));
      await Promise.all(promises);
      toast.success(`${dirty.size} ajuste(s) guardado(s)`);
      setDirty(new Set());
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleBoolSetting = (key: string) => {
    const current = values[key] === "true";
    updateValue(key, (!current).toString());
  };

  const handleDefaultProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "defaults");
    if (url) {
      updateValue("default_product_image", url);
      await upsertSetting("default_product_image", url);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Imagen por defecto guardada");
    }
  };

  const resetColors = async () => {
    if (!confirm("¿Restablecer colores por defecto?")) return;
    for (const [key, { hex }] of Object.entries(DEFAULT_COLORS)) {
      updateValue(key, hex);
    }
  };

  // Group settings
  const groups = Object.entries(GROUP_LABELS);

  const renderTextField = (key: string) => {
    const meta = settingsMeta[key];
    const isDirty = dirty.has(key);
    return (
      <div key={key} className={`rounded-xl p-2.5 border transition-colors ${isDirty ? "border-accent/50 bg-accent/5" : "border-border bg-card"}`}>
        <label className="text-xs font-medium text-foreground mb-0.5 block">{meta.label}</label>
        {meta.description && <p className="text-[10px] text-muted-foreground mb-1">{meta.description}</p>}
        <input
          value={values[key] || ""}
          onChange={(e) => updateValue(key, e.target.value)}
          className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
        />
      </div>
    );
  };

  const renderToggle = (key: string) => {
    const meta = settingsMeta[key];
    const isOn = values[key] === "true";
    const Icon = isOn ? Eye : EyeOff;
    const isDirty = dirty.has(key);
    return (
      <div key={key} className={`rounded-xl px-3 py-2 border flex items-center gap-2 transition-colors ${isDirty ? "border-accent/50 bg-accent/5" : "border-border bg-card"}`}>
        <Icon size={14} className={isOn ? "text-accent" : "text-muted-foreground"} />
        <span className="flex-1 text-sm text-foreground">{meta.label}</span>
        <Switch checked={isOn} onCheckedChange={() => toggleBoolSetting(key)} />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Global save bar */}
      <div className="sticky top-[52px] z-30 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-sm text-foreground">Configuración</h2>
          {dirty.size > 0 ? (
            <p className="text-[10px] text-accent font-medium">{dirty.size} cambio(s) sin guardar</p>
          ) : lastSaved ? (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={10} className="text-secondary" /> Guardado
            </p>
          ) : null}
        </div>
        <button
          onClick={saveAll}
          disabled={saving || dirty.size === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            dirty.size > 0
              ? "bg-accent text-accent-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground"
          } disabled:opacity-50`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
      </div>

      {/* Default product image */}
      <div className="bg-card rounded-xl p-2.5 border border-border flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-dashed border-border shrink-0">
          {values.default_product_image ? (
            <img src={values.default_product_image} alt="Default" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={18} className="text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Imagen por defecto</p>
          <p className="text-[10px] text-muted-foreground">Para productos sin imagen</p>
        </div>
        <label className="flex items-center gap-1 cursor-pointer bg-accent text-accent-foreground rounded-lg px-2.5 py-1.5 text-[11px] font-medium hover:opacity-90 transition-opacity shrink-0">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Subir
          <input type="file" accept="image/*" onChange={handleDefaultProductImage} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* Grouped settings */}
      {groups.map(([groupKey, groupLabel]) => {
        const groupSettings = Object.keys(settingsMeta).filter((k) => settingsMeta[k].group === groupKey);
        if (groupSettings.length === 0) return null;
        const hasText = groupSettings.some((k) => settingsMeta[k].type === "text");
        const hasToggle = groupSettings.some((k) => settingsMeta[k].type === "toggle");

        return (
          <div key={groupKey} className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground px-1">{groupLabel}</p>
            {hasText && groupSettings.filter((k) => settingsMeta[k].type === "text").map(renderTextField)}
            {hasToggle && (
              <div className="space-y-1">
                {groupSettings.filter((k) => settingsMeta[k].type === "toggle").map(renderToggle)}
              </div>
            )}
          </div>
        );
      })}


      {/* YCloud Test Panel */}
      {values.ycloud_api_key && values.ycloud_from_number && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground px-1">📲 Probar YCloud WhatsApp</p>
          <div className="bg-card rounded-xl p-3 border border-border space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Wifi size={12} className="text-secondary" />
              <span className="text-muted-foreground">Remitente: <span className="text-foreground font-medium">{values.ycloud_from_number}</span></span>
              <button
                onClick={checkYCloudBalance}
                disabled={checkingBalance}
                className="ml-auto text-[10px] bg-muted hover:bg-muted/80 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
              >
                {checkingBalance ? <Loader2 size={10} className="animate-spin" /> : <DollarSign size={10} />}
                Balance
              </button>
            </div>
            {balance !== null && (
              <p className="text-[10px] bg-secondary/10 text-secondary rounded-lg px-2 py-1 font-medium">Balance: {balance}</p>
            )}
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Número destino: 573001234567"
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none"
            />
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={2}
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none resize-none"
            />
            <button
              onClick={sendTestWhatsApp}
              disabled={sendingTest}
              className="w-full bg-secondary text-secondary-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar Mensaje de Prueba
            </button>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Palette size={12} /> 🎨 Paleta de Colores
          </p>
          <button onClick={resetColors} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <RotateCcw size={10} /> Reset
          </button>
        </div>

        {Object.entries(DEFAULT_COLORS).map(([key, { hex: defaultHex, label, desc }]) => {
          const currentHex = values[key] || defaultHex;
          const isDirty = dirty.has(key);
          return (
            <div key={key} className={`bg-card rounded-xl p-2.5 border flex items-center gap-3 transition-colors ${isDirty ? "border-accent/50" : "border-border"}`}>
              <input
                type="color"
                value={currentHex}
                onChange={(e) => updateValue(key, e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer border border-border bg-transparent shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
              <div className="h-3 w-7 rounded-full shrink-0" style={{ backgroundColor: currentHex }} />
            </div>
          );
        })}
      </div>

      {/* Bottom save */}
      {dirty.size > 0 && (
        <div className="sticky bottom-4 z-30">
          <button
            onClick={saveAll}
            disabled={saving}
            className="w-full bg-accent text-accent-foreground rounded-xl py-3 font-heading font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar {dirty.size} cambio(s)
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
