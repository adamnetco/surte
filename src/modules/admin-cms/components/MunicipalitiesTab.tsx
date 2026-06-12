import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, X, MapPin, Pencil, ExternalLink, Link as LinkIcon, AlertCircle, Search, Image as ImageIcon, Upload, Loader2, Eye, BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useImageUpload } from "@/modules/admin-cms/hooks/useImageUpload";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { scopedFrom } from "@/modules/tenant/lib/tenantScope";

const genSlug = (city: string) =>
  city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const calcSeoScore = (m: any) => {
  let score = 0;
  const t = m.meta_title || "";
  const d = m.meta_description || "";
  if (t.length >= 20 && t.length <= 60) score += 30; else if (t.length > 0) score += 10;
  if (d.length >= 80 && d.length <= 160) score += 30; else if (d.length > 0) score += 10;
  if (m.og_image_url) score += 20;
  if (m.slug) score += 20;
  return score;
};

const scoreBadge = (score: number) => {
  if (score >= 80) return { color: "text-secondary bg-secondary/10", label: `${score}%` };
  if (score >= 50) return { color: "text-accent bg-accent/10", label: `${score}%` };
  return { color: "text-destructive bg-destructive/10", label: `${score}%` };
};

const MunicipalitiesTab = ({ queryClient }: { queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const { data: municipalities, isLoading, error: queryError } = useQuery({
    queryKey: ["admin-municipalities", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await scopedFrom("municipality_settings", orgId).order("city");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    city: "", min_order_amount: "120000", is_active: true,
    slug: "", meta_title: "", meta_description: "", og_image_url: "",
    free_shipping_enabled: false, free_shipping_threshold: "150000",
  });
  const [saving, setSaving] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const { upload, uploading } = useImageUpload();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-municipalities", orgId] });
    queryClient.invalidateQueries({ queryKey: ["municipalities"] });
  };

  const friendlyError = (msg: string) => {
    if (msg.includes("row-level security") || msg.includes("policy")) return "Sin permisos. Verifica que tu sesión esté activa e inicia sesión de nuevo.";
    if (msg.includes("duplicate") || msg.includes("unique")) return "Ya existe un municipio con ese nombre o slug.";
    return msg;
  };

  const autoFillSeo = (cityName: string) => {
    const slug = genSlug(cityName);
    setForm((prev) => ({
      ...prev,
      slug: prev.slug || slug,
      meta_title: prev.meta_title || `Domicilios en ${cityName} | Pedidos online`,
      meta_description: prev.meta_description || `Pide productos con envío a domicilio en ${cityName}. Precios al mayor y al detal.`,
    }));
  };

  const save = async () => {
    if (!orgId) { toast.error("Selecciona una organización"); return; }
    if (!form.city.trim()) { toast.error("Ciudad es obligatoria"); return; }
    setSaving(true);
    const slug = form.slug.trim() || genSlug(form.city);
    const payload: any = {
      city: form.city.trim(),
      min_order_amount: Number(form.min_order_amount) || 120000,
      is_active: form.is_active,
      slug,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      og_image_url: form.og_image_url.trim() || null,
      free_shipping_enabled: form.free_shipping_enabled,
      free_shipping_threshold: Number(form.free_shipping_threshold) || 150000,
      organization_id: orgId,
    };

    try {
      if (editing && editing !== "new") {
        const { error } = await supabase.from("municipality_settings").update(payload).eq("id", editing).eq("organization_id", orgId);
        if (error) { toast.error(friendlyError(error.message)); return; }
        toast.success("Municipio actualizado");
      } else {
        const { error } = await supabase.from("municipality_settings").insert(payload);
        if (error) { toast.error(friendlyError(error.message)); return; }
        toast.success("Municipio creado");
      }
      invalidate();
      setEditing(null);
      setShowSeo(false);
      setForm({ city: "", min_order_amount: "120000", is_active: true, slug: "", meta_title: "", meta_description: "", og_image_url: "", free_shipping_enabled: false, free_shipping_threshold: "150000" });
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!orgId) return;
    if (!confirm("¿Eliminar municipio?")) return;
    const { error } = await supabase.from("municipality_settings").delete().eq("id", id).eq("organization_id", orgId);
    if (error) { toast.error(friendlyError(error.message)); return; }
    invalidate();
    toast.success("Municipio eliminado");
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!orgId) return;
    queryClient.setQueryData(["admin-municipalities", orgId], (old: any) =>
      old?.map((m: any) => m.id === id ? { ...m, is_active: !current } : m)
    );
    const { error } = await supabase.from("municipality_settings").update({ is_active: !current }).eq("id", id).eq("organization_id", orgId);
    if (error) {
      toast.error(friendlyError(error.message));
      invalidate();
      return;
    }
    toast.success(!current ? "Municipio activo" : "Municipio oculto");
    invalidate();
  };

  const copyUrl = (city: string, slug?: string) => {
    const s = slug || genSlug(city);
    navigator.clipboard.writeText(`${window.location.origin}/hub/ciudad/${s}`);
    toast.success("URL copiada");
  };

  const startEdit = (m: any) => {
    setForm({
      city: m.city,
      min_order_amount: String(m.min_order_amount),
      is_active: m.is_active,
      slug: m.slug || "",
      meta_title: m.meta_title || "",
      meta_description: m.meta_description || "",
      og_image_url: m.og_image_url || "",
      free_shipping_enabled: !!m.free_shipping_enabled,
      free_shipping_threshold: String(m.free_shipping_threshold || 150000),
    });
    setEditing(m.id);
    setShowSeo(!!m.meta_title || !!m.meta_description || !!m.og_image_url);
  };

  const handleOgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "seo");
    if (url) {
      setForm((prev) => ({ ...prev, og_image_url: url }));
      toast.success("Imagen OG subida");
    }
  };

  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
  const activeCount = municipalities?.filter((m: any) => m.is_active).length || 0;
  const avgSeo = municipalities?.length
    ? Math.round(municipalities.reduce((s: number, m: any) => s + calcSeoScore(m), 0) / municipalities.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Municipios</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activos</span> · {(municipalities?.length || 0) - activeCount} ocultos
            {municipalities && municipalities.length > 0 && (
              <> · SEO promedio: <span className={avgSeo >= 80 ? "text-secondary" : avgSeo >= 50 ? "text-accent" : "text-destructive"}>{avgSeo}%</span></>
            )}
          </p>
        </div>
        <button onClick={() => { setForm({ city: "", min_order_amount: "120000", is_active: true, slug: "", meta_title: "", meta_description: "", og_image_url: "", free_shipping_enabled: false, free_shipping_threshold: "150000" }); setEditing("new"); setShowSeo(false); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {queryError && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span>Error al cargar municipios. Verifica tu conexión e intenta de nuevo.</span>
        </div>
      )}

      {editing && (
        <div className="bg-card rounded-xl p-4 border border-accent/30 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-heading font-semibold text-sm text-foreground">{editing === "new" ? "Nuevo" : "Editar"} Municipio</span>
            <button onClick={() => { setEditing(null); setShowSeo(false); }}><X size={18} className="text-muted-foreground" /></button>
          </div>

          {/* Basic fields */}
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Nombre del municipio *</label>
            <input
              value={form.city}
              onChange={(e) => {
                setForm({ ...form, city: e.target.value });
              }}
              onBlur={() => { if (form.city && !form.slug) autoFillSeo(form.city); }}
              placeholder="Ej: Bucaramanga"
              className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Pedido mínimo (COP)</label>
            <input type="number" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} placeholder="120000" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-sm text-foreground">{form.is_active ? "Activo" : "Inactivo"}</span>
          </div>

          {/* Free shipping toggle + threshold */}
          <div className="bg-secondary/5 border border-secondary/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🚚</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Domicilio gratis por monto</p>
                  <p className="text-[10px] text-muted-foreground">Si el subtotal supera el umbral, el envío es gratis</p>
                </div>
              </div>
              <Switch checked={form.free_shipping_enabled} onCheckedChange={(v) => setForm({ ...form, free_shipping_enabled: v })} />
            </div>
            {form.free_shipping_enabled && (
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Umbral de envío gratis (COP)</label>
                <input
                  type="number"
                  value={form.free_shipping_threshold}
                  onChange={(e) => setForm({ ...form, free_shipping_threshold: e.target.value })}
                  placeholder="150000"
                  className="w-full bg-card rounded-lg px-3 py-2 text-sm border border-secondary/30 focus:border-secondary focus:outline-none transition-colors font-mono"
                />
                <p className="text-[10px] text-secondary mt-1">
                  Pedidos ≥ {fmt.format(Number(form.free_shipping_threshold) || 0)} → domicilio gratis
                </p>
              </div>
            )}
          </div>

          {/* SEO Toggle */}
          <button
            onClick={() => { setShowSeo(!showSeo); if (!showSeo && form.city && !form.meta_title) autoFillSeo(form.city); }}
            className="w-full flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <span className="flex items-center gap-1.5"><Search size={12} className="text-accent" /> SEO & Metadatos</span>
            <span className="text-[10px] text-muted-foreground">{showSeo ? "Ocultar ▲" : "Expandir ▼"}</span>
          </button>

          {showSeo && (
            <div className="space-y-3 border-t border-border pt-3">
              {/* Slug */}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Slug (URL amigable)</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground shrink-0">/hub/ciudad/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}
                    placeholder={genSlug(form.city || "ejemplo")}
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Meta Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-muted-foreground">Meta Título</label>
                  <span className={`text-[9px] font-medium ${form.meta_title.length >= 20 && form.meta_title.length <= 60 ? "text-secondary" : form.meta_title.length > 0 ? "text-accent" : "text-muted-foreground"}`}>
                    {form.meta_title.length}/60
                  </span>
                </div>
                <input
                  value={form.meta_title}
                  onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                  placeholder={`Domicilios en ${form.city || "Ciudad"} — SURTÉ YA`}
                  className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
                />
              </div>

              {/* Meta Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-muted-foreground">Meta Descripción</label>
                  <span className={`text-[9px] font-medium ${form.meta_description.length >= 80 && form.meta_description.length <= 160 ? "text-secondary" : form.meta_description.length > 0 ? "text-accent" : "text-muted-foreground"}`}>
                    {form.meta_description.length}/160
                  </span>
                </div>
                <textarea
                  value={form.meta_description}
                  onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                  placeholder={`Pide salsas, cárnicos, pulpas y más con envío a domicilio en ${form.city || "tu ciudad"}...`}
                  rows={3}
                  className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* OG Image */}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Imagen Open Graph</label>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-dashed border-border shrink-0">
                    {form.og_image_url ? (
                      <img src={form.og_image_url} alt="OG" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={14} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <input
                    value={form.og_image_url}
                    onChange={(e) => setForm({ ...form, og_image_url: e.target.value })}
                    placeholder="URL de la imagen o subir..."
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
                  />
                  <label className="cursor-pointer bg-accent text-accent-foreground rounded-lg px-2 py-1.5 text-[10px] font-medium hover:opacity-90 transition-opacity shrink-0">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    <input type="file" accept="image/*" onChange={handleOgImage} className="hidden" disabled={uploading} />
                  </label>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">Recomendado: 1200×630px. Si no se configura, se usará la imagen OG predeterminada del sitio.</p>
              </div>

              {/* SERP Preview */}
              {(form.meta_title || form.meta_description) && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-0.5">
                  <p className="text-[9px] text-muted-foreground font-medium mb-1">Vista previa en Google</p>
                  <p className="text-sm text-[#1a0dab] font-medium leading-tight truncate">
                    {form.meta_title || `Domicilios en ${form.city} — SURTÉ YA`}
                  </p>
                  <p className="text-[11px] text-[#006621] truncate">surteya.com › hub › ciudad › {form.slug || genSlug(form.city || "ciudad")}</p>
                  <p className="text-xs text-[#545454] line-clamp-2 leading-snug">
                    {form.meta_description || `Pide salsas, cárnicos, pulpas y más con envío a ${form.city}...`}
                  </p>
                </div>
              )}

              {/* Auto-fill button */}
              {form.city && !form.meta_title && (
                <button
                  onClick={() => autoFillSeo(form.city)}
                  className="w-full text-[11px] text-accent hover:underline text-center py-1"
                >
                  ✨ Auto-generar SEO para "{form.city}"
                </button>
              )}
            </div>
          )}

          <button onClick={save} disabled={saving} className="btn-surte w-full text-sm py-2.5 flex items-center justify-center gap-1 disabled:opacity-50">
            <Save size={14} /> {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>}
      <div className="space-y-2">
        {municipalities?.length === 0 && !isLoading && (
          <div className="text-center py-8 space-y-2">
            <MapPin size={32} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay municipios configurados</p>
            <button onClick={() => { setForm({ city: "", min_order_amount: "120000", is_active: true, slug: "", meta_title: "", meta_description: "", og_image_url: "", free_shipping_enabled: false, free_shipping_threshold: "150000" }); setEditing("new"); setShowSeo(false); }} className="text-xs text-accent hover:underline">
              + Crear el primero
            </button>
          </div>
        )}
        {municipalities?.map((m: any) => {
          const seo = calcSeoScore(m);
          const badge = scoreBadge(seo);
          return (
            <div key={m.id} className={`flex items-center gap-2 bg-card rounded-xl p-3 border border-border transition-opacity ${!m.is_active ? "opacity-50" : ""}`}>
              <MapPin size={16} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{m.city}</p>
                  {!m.is_active && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">OCULTO</span>}
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>SEO {badge.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mín. {fmt.format(m.min_order_amount)}
                  {m.free_shipping_enabled && (
                    <span className="ml-1.5 text-[10px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded-full font-semibold">
                      🚚 Gratis ≥ {fmt.format(m.free_shipping_threshold || 150000)}
                    </span>
                  )}
                </p>
              </div>
              <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m.id, m.is_active)} />
              <button onClick={() => copyUrl(m.city, m.slug)} className="text-muted-foreground hover:text-primary transition-colors p-1.5" title="Copiar URL"><LinkIcon size={14} /></button>
              <a href={`/hub/ciudad/${m.slug || genSlug(m.city)}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1.5" title="Ver página"><ExternalLink size={14} /></a>
              <button onClick={() => startEdit(m)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5"><Pencil size={14} /></button>
              <button onClick={() => del(m.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5"><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MunicipalitiesTab;
