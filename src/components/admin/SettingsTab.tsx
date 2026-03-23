import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Eye, EyeOff, DollarSign, Phone, Store, Palette, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const DEFAULT_COLORS: Record<string, { hex: string; label: string; desc: string }> = {
  color_primary: { hex: "#0C4B83", label: "Azul Confianza", desc: "Headers, navegación y confianza institucional" },
  color_secondary: { hex: "#76B833", label: "Verde Vitalidad", desc: "Éxito, frescura y productos naturales" },
  color_accent: { hex: "#F37021", label: "Naranja Energía", desc: "CTA, promociones y estímulo de apetito" },
  color_tierra: { hex: "#8D6E63", label: "Tierra Santandereana", desc: "Fondos cálidos y empaques artesanales" },
  color_cream: { hex: "#F0F0F0", label: "Cloud Dancer", desc: "Base orgánica, fondo limpio y artesanal" },
};

const SettingsTab = ({ settings, queryClient }: { settings: any[]; queryClient: any }) => {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      const v: Record<string, string> = {};
      settings.forEach((s: any) => { v[s.key] = s.value; });
      setValues(v);
    }
  }, [settings]);

  const saveSetting = async (key: string) => {
    const existing = settings?.find((s: any) => s.key === key);
    if (existing) {
      const { error } = await supabase.from("app_settings").update({ value: values[key] }).eq("key", key);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("app_settings").insert({ key, value: values[key] });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${settingsMeta[key]?.label || key} actualizado`);
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
  };

  const toggleBoolSetting = async (key: string) => {
    const current = values[key] === "true";
    const newVal = (!current).toString();
    setValues({ ...values, [key]: newVal });
    const existing = settings?.find((s: any) => s.key === key);
    if (existing) {
      await supabase.from("app_settings").update({ value: newVal }).eq("key", key);
    } else {
      await supabase.from("app_settings").insert({ key, value: newVal });
    }
    toast.success(`${settingsMeta[key]?.label || key} ${!current ? "activado" : "desactivado"}`);
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
  };

  const saveColor = async (key: string, hex: string) => {
    setValues({ ...values, [key]: hex });
    const existing = settings?.find((s: any) => s.key === key);
    if (existing) {
      await supabase.from("app_settings").update({ value: hex }).eq("key", key);
    } else {
      await supabase.from("app_settings").insert({ key, value: hex });
    }
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    toast.success("Color actualizado");
  };

  const resetColors = async () => {
    if (!confirm("¿Restablecer todos los colores a los valores por defecto?")) return;
    for (const [key, { hex }] of Object.entries(DEFAULT_COLORS)) {
      const existing = settings?.find((s: any) => s.key === key);
      if (existing) {
        await supabase.from("app_settings").update({ value: hex }).eq("key", key);
      } else {
        await supabase.from("app_settings").insert({ key, value: hex });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    toast.success("Colores restablecidos");
  };

  type SettingMeta = { label: string; icon: typeof Save; type: "text" | "toggle"; description?: string };
  const settingsMeta: Record<string, SettingMeta> = {
    store_name: { label: "Nombre de la Tienda", icon: Store, type: "text" },
    whatsapp_number: { label: "Número WhatsApp", icon: Phone, type: "text", description: "Con código de país: 573001234567" },
    min_order_amount: { label: "Pedido Mínimo (COP)", icon: DollarSign, type: "text", description: "Monto mínimo para realizar un pedido" },
    show_price_tiers: { label: "Mostrar Precios Escalonados", icon: Eye, type: "toggle", description: "Muestra precios Mayor y Distribuidor en el catálogo" },
  };

  const textSettings = Object.entries(values).filter(([key]) => settingsMeta[key]?.type === "text");
  const toggleSettings = Object.entries(values).filter(([key]) => settingsMeta[key]?.type === "toggle");

  return (
    <div className="space-y-6">
      <h2 className="font-heading font-bold text-lg text-foreground">Configuración</h2>

      {/* Text settings */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">General</p>
        {textSettings.map(([key, value]) => {
          const meta = settingsMeta[key];
          const Icon = meta?.icon || Save;
          return (
            <div key={key} className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-accent" />
                <label className="text-sm font-medium text-foreground">{meta?.label || key}</label>
              </div>
              {meta?.description && <p className="text-[11px] text-muted-foreground mb-2">{meta.description}</p>}
              <div className="flex gap-2">
                <input
                  value={value}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
                />
                <button onClick={() => saveSetting(key)} className="bg-accent text-accent-foreground rounded-lg px-3.5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity">
                  <Save size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toggle settings */}
      {toggleSettings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibilidad</p>
          {toggleSettings.map(([key, value]) => {
            const meta = settingsMeta[key];
            const isOn = value === "true";
            const Icon = isOn ? Eye : EyeOff;
            return (
              <div key={key} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
                <Icon size={18} className={isOn ? "text-accent" : "text-muted-foreground"} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{meta?.label || key}</p>
                  {meta?.description && <p className="text-[11px] text-muted-foreground">{meta.description}</p>}
                </div>
                <Switch checked={isOn} onCheckedChange={() => toggleBoolSetting(key)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Color Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette size={14} className="text-accent" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paleta de Colores — Sabor Santandereano</p>
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
                  <div className="relative">
                    <input
                      type="color"
                      value={currentHex}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                      className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border bg-transparent"
                    />
                  </div>
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
                {/* Preview bar */}
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
