import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, CheckCircle2, Search, Globe, Tag, BarChart3, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useImageUpload } from "@/hooks/useImageUpload";

const SEO_SETTINGS: { key: string; label: string; placeholder: string; group: string; description?: string }[] = [
  { key: "seo_site_name", label: "Nombre del Sitio", placeholder: "SURTÉ YA - Soluciones Alimenticias", group: "general" },
  { key: "seo_default_description", label: "Meta Descripción Global", placeholder: "Salsas, cárnicos y pulpas al mayor...", group: "general" },
  { key: "seo_default_og_image", label: "Imagen OG Predeterminada", placeholder: "https://surteya.com/og-default.jpg", group: "general", description: "Imagen por defecto para Schema.org y Open Graph (1200×630px). Se usa en todas las páginas que no tengan imagen propia." },
  { key: "seo_ga4_measurement_id", label: "Google Analytics 4 (Measurement ID)", placeholder: "G-XXXXXXXXXX", group: "integraciones" },
  { key: "seo_google_merchant_id", label: "Google Merchant Center ID", placeholder: "123456789", group: "integraciones" },
  { key: "seo_facebook_pixel_id", label: "Facebook Pixel ID", placeholder: "123456789", group: "integraciones" },
  { key: "seo_facebook_catalog_id", label: "Facebook Catalog ID", placeholder: "123456789", group: "integraciones" },
  { key: "social_facebook", label: "URL Facebook", placeholder: "https://facebook.com/surtecol", group: "social" },
  { key: "social_instagram", label: "URL Instagram", placeholder: "https://instagram.com/surtecol", group: "social" },
  { key: "social_tiktok", label: "URL TikTok", placeholder: "https://tiktok.com/@surtecol", group: "social" },
];

const SeoTab = ({ settings, queryClient }: { settings: any[]; queryClient: any }) => {
  const { upload, uploading } = useImageUpload();
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

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

  const saveAll = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      for (const key of dirty) {
        const existing = settings?.find((s: any) => s.key === key);
        if (existing) {
          await supabase.from("app_settings").update({ value: values[key] || "" }).eq("id", existing.id);
        } else {
          await supabase.from("app_settings").insert({ key, value: values[key] || "" });
        }
      }
      toast.success("SEO guardado");
      setDirty(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const groups = [
    { key: "general", label: "🔍 SEO General", icon: Search },
    { key: "integraciones", label: "📊 Merchant & Pixel", icon: BarChart3 },
    { key: "social", label: "🌐 Redes Sociales", icon: Globe },
  ];

  return (
    <div className="space-y-4">
      <div className="sticky top-[52px] z-30 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-sm text-foreground">SEO & Indexación</h2>
          {dirty.size > 0 && <p className="text-[10px] text-accent font-medium">{dirty.size} cambio(s)</p>}
        </div>
        <button
          onClick={saveAll}
          disabled={saving || dirty.size === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${dirty.size > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"} disabled:opacity-50`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
        </button>
      </div>

      {/* Info card */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
        <p className="text-xs text-foreground font-medium mb-1">📌 SEO Local Avanzado</p>
        <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
          <li>JSON-LD automático: LocalBusiness, Product, BreadcrumbList, WebSite</li>
          <li>Cada producto genera schema.org/Product con ofertas, SKU, GTIN, marca</li>
          <li>Canonical URLs y Open Graph para indexación en Google y Facebook</li>
          <li>Compatible con Google Merchant Center y Facebook Catalog</li>
        </ul>
      </div>

      {groups.map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground px-1">{label}</p>
          {SEO_SETTINGS.filter((s) => s.group === key).map((s) => (
            <div key={s.key} className={`rounded-xl p-2.5 border transition-colors ${dirty.has(s.key) ? "border-accent/50 bg-accent/5" : "border-border bg-card"}`}>
              <label className="text-xs font-medium text-foreground mb-0.5 block">{s.label}</label>
              <input
                value={values[s.key] || ""}
                onChange={(e) => updateValue(s.key, e.target.value)}
                placeholder={s.placeholder}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none"
              />
            </div>
          ))}
        </div>
      ))}

      {/* Product SEO quick info */}
      <div className="bg-card rounded-xl p-3 border border-border">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1"><Tag size={12} /> SEO de Productos</p>
        <p className="text-[10px] text-muted-foreground">
          Cada producto tiene campos SEO (slug, meta título, meta descripción, marca, SKU, GTIN, peso) editables desde la pestaña de Productos. 
          Estos datos alimentan automáticamente el schema.org/Product y las etiquetas Open Graph de cada página de producto.
        </p>
      </div>

      {/* Sitemap info */}
      <div className="bg-card rounded-xl p-3 border border-border">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1"><Globe size={12} /> Sitemap Dinámico</p>
        <p className="text-[10px] text-muted-foreground mb-2">
          El sitemap XML se genera automáticamente con todos los productos y categorías activos. Registra esta URL en Google Search Console.
        </p>
        <code className="text-[10px] bg-muted px-2 py-1 rounded block break-all">
          {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sitemap`}
        </code>
      </div>

      {/* Tracking page info */}
      <div className="bg-card rounded-xl p-3 border border-border">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1"><BarChart3 size={12} /> Seguimiento de Pedidos</p>
        <p className="text-[10px] text-muted-foreground">
          Cada pedido genera un enlace público de seguimiento en tiempo real (ej: /pedido/1234). 
          El cliente recibe este enlace en el mensaje de WhatsApp y puede consultar el estado de su compra.
        </p>
      </div>
    </div>
  );
};

export default SeoTab;
