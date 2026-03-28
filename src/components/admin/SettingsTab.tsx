import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Eye, EyeOff, DollarSign, Phone, Store, Palette, RotateCcw, Upload, Loader2, Image as ImageIcon, Link2, Award } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useImageUpload } from "@/hooks/useImageUpload";

const DEFAULT_COLORS: Record<string, { hex: string; label: string; desc: string }> = {
  color_primary: { hex: "#0C4B83", label: "Azul Confianza", desc: "Headers, navegación y confianza institucional" },
  color_secondary: { hex: "#76B833", label: "Verde Vitalidad", desc: "Éxito, frescura y productos naturales" },
  color_accent: { hex: "#F37021", label: "Naranja Energía", desc: "CTA, promociones y estímulo de apetito" },
  color_tierra: { hex: "#8D6E63", label: "Tierra Santandereana", desc: "Fondos cálidos y empaques artesanales" },
  color_cream: { hex: "#F0F0F0", label: "Cloud Dancer", desc: "Base orgánica, fondo limpio y artesanal" },
};

const SettingsTab = ({ settings, queryClient }: { settings: any[]; queryClient: any }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { upload, uploading } = useImageUpload();

  useEffect(() => {
    if (settings) {
      const v: Record<string, string> = {};
      settings.forEach((s: any) => { v[s.key] = s.value; });
      setValues(v);
    }
  }, [settings]);

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

  const saveSetting = async (key: string) => {
    setSaving(key);
    try {
      await upsertSetting(key, values[key] || "");
      toast.success(`${settingsMeta[key]?.label || key} guardado`);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const toggleBoolSetting = async (key: string) => {
    const current = values[key] === "true";
    const newVal = (!current).toString();
    setValues((prev) => ({ ...prev, [key]: newVal }));
    try {
      await upsertSetting(key, newVal);
      toast.success(`${settingsMeta[key]?.label || key} ${!current ? "activado" : "desactivado"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    } catch (err: any) {
      toast.error(err.message);
      setValues((prev) => ({ ...prev, [key]: current.toString() }));
    }
  };

  const saveColor = async (key: string, hex: string) => {
    setValues((prev) => ({ ...prev, [key]: hex }));
    try {
      await upsertSetting(key, hex);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Color actualizado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetColors = async () => {
    if (!confirm("¿Restablecer todos los colores a los valores por defecto?")) return;
    for (const [key, { hex }] of Object.entries(DEFAULT_COLORS)) {
      await upsertSetting(key, hex);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    toast.success("Colores restablecidos");
  };

  const handleDefaultProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "defaults");
    if (url) {
      setValues((prev) => ({ ...prev, default_product_image: url }));
      await upsertSetting("default_product_image", url);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Imagen por defecto guardada");
    }
  };

  type SettingMeta = { label: string; icon: typeof Save; type: "text" | "toggle"; description?: string };
  const settingsMeta: Record<string, SettingMeta> = {
    store_name: { label: "Nombre de la Tienda", icon: Store, type: "text" },
    whatsapp_number: { label: "Número WhatsApp", icon: Phone, type: "text", description: "Con código de país: 573001234567" },
    min_order_amount: { label: "Pedido Mínimo (COP)", icon: DollarSign, type: "text", description: "Monto mínimo para realizar un pedido" },
    footer_text: { label: "Texto Legal Pie de Página", icon: Save, type: "text", description: "Texto legal que aparece en el footer" },
    footer_nit: { label: "NIT Empresa", icon: Save, type: "text", description: "NIT de Conjuguémonos Grupo Empresarial" },
    footer_email: { label: "Email de Contacto", icon: Save, type: "text", description: "Email público de la empresa" },
    footer_address: { label: "Dirección Física", icon: Save, type: "text", description: "Dirección de la sede principal" },
    external_sync_webhook_url: { label: "Webhook Sincronización Externa", icon: Link2, type: "text", description: "URL donde se enviarán los pedidos para alistamiento externo" },
    trust_badge_1_label: { label: "Badge 1 — Título", icon: Award, type: "text", description: "Ej: Envío Gratis" },
    trust_badge_1_sub: { label: "Badge 1 — Subtítulo", icon: Award, type: "text", description: "Ej: +$40.000" },
    trust_badge_2_label: { label: "Badge 2 — Título", icon: Award, type: "text", description: "Ej: Pago Seguro" },
    trust_badge_2_sub: { label: "Badge 2 — Subtítulo", icon: Award, type: "text", description: "Ej: Contraentrega" },
    trust_badge_3_label: { label: "Badge 3 — Título", icon: Award, type: "text", description: "Ej: Calidad" },
    trust_badge_3_sub: { label: "Badge 3 — Subtítulo", icon: Award, type: "text", description: "Ej: Garantizada" },
    show_price_tiers: { label: "Mostrar Precios Escalonados", icon: Eye, type: "toggle", description: "Muestra precios Mayor y Distribuidor en el catálogo" },
    show_section_offers: { label: "Sección de Ofertas", icon: Eye, type: "toggle", description: "Mostrar/ocultar la sección de ofertas relámpago en el Home" },
    show_section_testimonials: { label: "Sección de Testimonios", icon: Eye, type: "toggle", description: "Mostrar/ocultar testimonios de clientes" },
    show_section_gallery: { label: "Sección de Galería", icon: Eye, type: "toggle", description: "Mostrar/ocultar la galería de fotos" },
    show_section_brands: { label: "Sección de Marcas Aliadas", icon: Eye, type: "toggle", description: "Mostrar/ocultar logos de marcas" },
    show_section_promo: { label: "Sección Promocional", icon: Eye, type: "toggle", description: "Mostrar/ocultar la sección de salsas artesanales" },
    show_section_banners: { label: "Carrusel de Banners", icon: Eye, type: "toggle", description: "Mostrar/ocultar los banners del Home" },
  };

  // Ensure all settings keys exist in values for rendering
  const allKeys = Object.keys(settingsMeta);
  const textSettings = allKeys.filter((k) => settingsMeta[k].type === "text");
  const toggleSettings = allKeys.filter((k) => settingsMeta[k].type === "toggle");

  return (
    <div className="space-y-6">
      <h2 className="font-heading font-bold text-lg text-foreground">Configuración</h2>

      {/* Default product image */}
      <div className="bg-card rounded-xl p-4 border border-border space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-accent" />
          <label className="text-sm font-medium text-foreground">Imagen por Defecto de Productos</label>
        </div>
        <p className="text-[11px] text-muted-foreground">Se usará cuando un producto no tenga imagen asignada</p>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border shrink-0">
            {values.default_product_image ? (
              <img src={values.default_product_image} alt="Default" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={24} className="text-muted-foreground/40" />
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer bg-accent text-accent-foreground rounded-lg px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Subiendo..." : "Subir imagen"}
            <input type="file" accept="image/*" onChange={handleDefaultProductImage} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Text settings */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">General</p>
        {textSettings.map((key) => {
          const meta = settingsMeta[key];
          const Icon = meta.icon;
          return (
            <div key={key} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-accent" />
                <label className="text-sm font-medium text-foreground">{meta.label}</label>
              </div>
              {meta.description && <p className="text-[11px] text-muted-foreground mb-2">{meta.description}</p>}
              <div className="flex gap-2">
                <input
                  value={values[key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
                />
                <button
                  onClick={() => saveSetting(key)}
                  disabled={saving === key}
                  className="bg-accent text-accent-foreground rounded-lg px-3.5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving === key ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toggle settings */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibilidad</p>
        {toggleSettings.map((key) => {
          const meta = settingsMeta[key];
          const isOn = values[key] === "true";
          const Icon = isOn ? Eye : EyeOff;
          return (
            <div key={key} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
              <Icon size={18} className={isOn ? "text-accent" : "text-muted-foreground"} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{meta.label}</p>
                {meta.description && <p className="text-[11px] text-muted-foreground">{meta.description}</p>}
              </div>
              <Switch checked={isOn} onCheckedChange={() => toggleBoolSetting(key)} />
            </div>
          );
        })}
      </div>

      {/* Color Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette size={14} className="text-accent" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paleta de Colores</p>
          </div>
          <button onClick={resetColors} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <RotateCcw size={12} /> Restablecer
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {Object.entries(DEFAULT_COLORS).map(([key, { hex: defaultHex, label, desc }]) => {
            const currentHex = values[key] || defaultHex;
            return (
              <div key={key} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={currentHex}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border bg-transparent"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{currentHex.toUpperCase()}</p>
                  </div>
                  <button
                    onClick={() => saveColor(key, currentHex)}
                    className="bg-accent text-accent-foreground rounded-lg px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Save size={12} />
                  </button>
                </div>
                <div className="mt-2 h-2 rounded-full" style={{ backgroundColor: currentHex }} />
              </div>
            );
          })}
        </div>

        {/* Live Preview */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vista previa</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(DEFAULT_COLORS).map(([key, { label }]) => {
              const hex = values[key] || DEFAULT_COLORS[key].hex;
              return (
                <div key={key} className="text-center">
                  <div className="w-14 h-14 rounded-xl border-2 border-border mx-auto mb-1" style={{ backgroundColor: hex }} />
                  <p className="text-[9px] text-muted-foreground font-medium">{label.split(" ")[0]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
