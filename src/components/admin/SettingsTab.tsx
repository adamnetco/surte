import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Eye, EyeOff, DollarSign, Phone, Store, Palette, RotateCcw, Upload, Loader2, Image as ImageIcon, Link2, Award } from "lucide-react";
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

type SettingMeta = { label: string; icon: typeof Save; type: "text" | "toggle"; description?: string };

const settingsMeta: Record<string, SettingMeta> = {
  store_name: { label: "Nombre de la Tienda", icon: Store, type: "text" },
  whatsapp_number: { label: "Número WhatsApp", icon: Phone, type: "text", description: "Con código de país: 573001234567" },
  min_order_amount: { label: "Pedido Mínimo (COP)", icon: DollarSign, type: "text", description: "Monto mínimo para realizar un pedido" },
  footer_text: { label: "Texto Legal", icon: Save, type: "text" },
  footer_nit: { label: "NIT Empresa", icon: Save, type: "text" },
  footer_email: { label: "Email de Contacto", icon: Save, type: "text" },
  footer_address: { label: "Dirección Física", icon: Save, type: "text" },
  external_sync_webhook_url: { label: "Webhook Sync Externa", icon: Link2, type: "text", description: "URL para enviar pedidos" },
  trust_badge_1_label: { label: "Badge 1 — Título", icon: Award, type: "text" },
  trust_badge_1_sub: { label: "Badge 1 — Subtítulo", icon: Award, type: "text" },
  trust_badge_2_label: { label: "Badge 2 — Título", icon: Award, type: "text" },
  trust_badge_2_sub: { label: "Badge 2 — Subtítulo", icon: Award, type: "text" },
  trust_badge_3_label: { label: "Badge 3 — Título", icon: Award, type: "text" },
  trust_badge_3_sub: { label: "Badge 3 — Subtítulo", icon: Award, type: "text" },
  show_price_tiers: { label: "Precios Escalonados", icon: Eye, type: "toggle" },
  show_section_offers: { label: "Sección de Ofertas", icon: Eye, type: "toggle" },
  show_section_testimonials: { label: "Sección de Testimonios", icon: Eye, type: "toggle" },
  show_section_gallery: { label: "Sección de Galería", icon: Eye, type: "toggle" },
  show_section_brands: { label: "Marcas Aliadas", icon: Eye, type: "toggle" },
  show_section_promo: { label: "Sección Promocional", icon: Eye, type: "toggle" },
  show_section_banners: { label: "Carrusel de Banners", icon: Eye, type: "toggle" },
};

const SettingsTab = ({ settings, queryClient }: { settings: any[]; queryClient: any }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { upload, uploading } = useImageUpload();

  // Load from DB
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
      // Save immediately for images
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

  const textSettings = Object.keys(settingsMeta).filter((k) => settingsMeta[k].type === "text");
  const toggleSettings = Object.keys(settingsMeta).filter((k) => settingsMeta[k].type === "toggle");

  return (
    <div className="space-y-5">
      {/* Global save bar */}
      <div className="sticky top-[52px] z-30 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-4 py-2.5 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-base text-foreground">Configuración</h2>
          {dirty.size > 0 && (
            <p className="text-[10px] text-accent font-medium">{dirty.size} cambio(s) sin guardar</p>
          )}
        </div>
        <button
          onClick={saveAll}
          disabled={saving || dirty.size === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            dirty.size > 0
              ? "bg-accent text-accent-foreground hover:opacity-90 animate-pulse"
              : "bg-muted text-muted-foreground"
          } disabled:opacity-50`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar Todo
        </button>
      </div>

      {/* Default product image */}
      <div className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-dashed border-border shrink-0">
          {values.default_product_image ? (
            <img src={values.default_product_image} alt="Default" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Imagen por defecto</p>
          <p className="text-[10px] text-muted-foreground">Para productos sin imagen</p>
        </div>
        <label className="flex items-center gap-1 cursor-pointer bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity shrink-0">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Subir
          <input type="file" accept="image/*" onChange={handleDefaultProductImage} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* Text settings - compact */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">General</p>
        {textSettings.map((key) => {
          const meta = settingsMeta[key];
          const isDirty = dirty.has(key);
          return (
            <div key={key} className={`bg-card rounded-xl p-3 border transition-colors ${isDirty ? "border-accent/50" : "border-border"}`}>
              <label className="text-xs font-medium text-foreground mb-1 block">{meta.label}</label>
              {meta.description && <p className="text-[10px] text-muted-foreground mb-1.5">{meta.description}</p>}
              <input
                value={values[key] || ""}
                onChange={(e) => updateValue(key, e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          );
        })}
      </div>

      {/* Toggle settings */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Visibilidad</p>
        {toggleSettings.map((key) => {
          const meta = settingsMeta[key];
          const isOn = values[key] === "true";
          const Icon = isOn ? Eye : EyeOff;
          const isDirty = dirty.has(key);
          return (
            <div key={key} className={`bg-card rounded-xl px-3 py-2.5 border flex items-center gap-2 transition-colors ${isDirty ? "border-accent/50" : "border-border"}`}>
              <Icon size={14} className={isOn ? "text-accent" : "text-muted-foreground"} />
              <span className="flex-1 text-sm text-foreground">{meta.label}</span>
              <Switch checked={isOn} onCheckedChange={() => toggleBoolSetting(key)} />
            </div>
          );
        })}
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Palette size={12} /> Paleta de Colores
          </p>
          <button onClick={resetColors} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <RotateCcw size={10} /> Reset
          </button>
        </div>

        {Object.entries(DEFAULT_COLORS).map(([key, { hex: defaultHex, label, desc }]) => {
          const currentHex = values[key] || defaultHex;
          const isDirty = dirty.has(key);
          return (
            <div key={key} className={`bg-card rounded-xl p-3 border flex items-center gap-3 transition-colors ${isDirty ? "border-accent/50" : "border-border"}`}>
              <input
                type="color"
                value={currentHex}
                onChange={(e) => updateValue(key, e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
              <div className="h-3 w-8 rounded-full shrink-0" style={{ backgroundColor: currentHex }} />
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
