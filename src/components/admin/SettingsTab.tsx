import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import { toast } from "sonner";

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
    const { error } = await supabase.from("app_settings").update({ value: values[key] }).eq("key", key);
    if (error) { toast.error(error.message); return; }
    toast.success(`${key} actualizado`);
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
  };

  const settingLabels: Record<string, string> = {
    min_order_amount: "Pedido Mínimo ($COP)",
    whatsapp_number: "Número WhatsApp",
    store_name: "Nombre de la Tienda",
  };

  return (
    <div>
      <h2 className="font-heading font-bold text-lg text-foreground mb-4">Configuración</h2>
      <div className="space-y-3">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <label className="text-xs text-muted-foreground mb-1 block">{settingLabels[key] || key}</label>
            <div className="flex gap-2">
              <input value={value} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm" />
              <button onClick={() => saveSetting(key)} className="bg-accent text-accent-foreground rounded-lg px-3 py-2 text-sm font-medium"><Save size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsTab;
