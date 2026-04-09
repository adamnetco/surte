import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Pencil, Trash2, Globe, Eye, EyeOff, Loader2, ExternalLink,
  Copy, Search, FileDown, FileUp, CheckCircle2, AlertTriangle, Type,
  Image, List, Code, LayoutTemplate, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import TiptapEditor from "./TiptapEditor";

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  heading: string | null;
  body_html: string | null;
  city: string | null;
  page_type: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number | null;
}

const emptyPage: Partial<LandingPage> = {
  slug: "", title: "", meta_title: "", meta_description: "", heading: "",
  body_html: "", city: "", page_type: "custom", image_url: "", is_active: true,
};

// HTML snippets for SEO content
const HTML_SNIPPETS = [
  { label: "Párrafo SEO", icon: Type, html: `<p class="text-lg leading-relaxed">Escribe aquí tu contenido optimizado para SEO con palabras clave relevantes para tu negocio.</p>` },
  { label: "Lista de beneficios", icon: List, html: `<h2>¿Por qué elegirnos?</h2>\n<ul>\n  <li><strong>Envíos rápidos</strong> — Entrega en 24-48 horas</li>\n  <li><strong>Precios mayoristas</strong> — Los mejores precios del mercado</li>\n  <li><strong>Calidad garantizada</strong> — Productos frescos y certificados</li>\n  <li><strong>Atención personalizada</strong> — Soporte por WhatsApp</li>\n</ul>` },
  { label: "CTA con enlace", icon: ExternalLink, html: `<div style="text-align:center;margin:2rem 0">\n  <a href="/catalogo" style="display:inline-block;background:#F37021;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Catálogo Completo</a>\n</div>` },
  { label: "Imagen con caption", icon: Image, html: `<figure>\n  <img src="URL_DE_IMAGEN" alt="Descripción de la imagen" style="width:100%;border-radius:12px" loading="lazy" />\n  <figcaption style="text-align:center;font-size:0.875rem;color:#666;margin-top:0.5rem">Pie de foto descriptivo</figcaption>\n</figure>` },
  { label: "Sección H2 + texto", icon: LayoutTemplate, html: `<section>\n  <h2>Título de Sección</h2>\n  <p>Contenido descriptivo con <strong>palabras clave</strong> relevantes para posicionamiento local. Incluye información útil para el usuario y para los motores de búsqueda.</p>\n</section>` },
  { label: "FAQ Schema", icon: Code, html: `<section>\n  <h2>Preguntas Frecuentes</h2>\n  <details>\n    <summary><strong>¿Cuál es el pedido mínimo?</strong></summary>\n    <p>El pedido mínimo varía según tu ciudad. Consulta las condiciones en nuestra página de envíos.</p>\n  </details>\n  <details>\n    <summary><strong>¿Hacen envíos a todo Santander?</strong></summary>\n    <p>Sí, realizamos envíos a Bucaramanga, Floridablanca, Girón, Piedecuesta y más municipios de Santander.</p>\n  </details>\n</section>` },
];

// SEO score calculator
const calcSeoScore = (page: Partial<LandingPage>): { score: number; tips: string[] } => {
  const tips: string[] = [];
  let score = 0;
  
  if (page.meta_title && page.meta_title.length >= 30 && page.meta_title.length <= 60) score += 20;
  else tips.push("Meta título: 30-60 caracteres ideal");
  
  if (page.meta_description && page.meta_description.length >= 120 && page.meta_description.length <= 160) score += 20;
  else tips.push("Meta descripción: 120-160 caracteres ideal");
  
  if (page.heading && page.heading.length > 10) score += 15;
  else tips.push("Añade un H1 descriptivo (>10 chars)");
  
  if (page.body_html && page.body_html.length > 200) score += 15;
  else tips.push("Contenido HTML mínimo 200 caracteres");
  
  if (page.body_html && /<h2/i.test(page.body_html)) score += 10;
  else tips.push("Incluye al menos un <h2> en el contenido");
  
  if (page.image_url) score += 10;
  else tips.push("Añade una imagen destacada");
  
  if (page.city) score += 10;
  else tips.push("Especifica la ciudad para SEO local");
  
  return { score, tips };
};

const SeoScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? "text-secondary bg-secondary/10" : score >= 50 ? "text-yellow-600 bg-yellow-50" : "text-destructive bg-destructive/10";
  const icon = score >= 80 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
      {icon} {score}%
    </span>
  );
};

const LandingPagesTab = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<LandingPage> | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showSnippets, setShowSnippets] = useState(false);
  const [editorTab, setEditorTab] = useState<"visual" | "code">("visual");

  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing_pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landing_pages").select("*").order("sort_order");
      if (error) throw error;
      return data as LandingPage[];
    },
  });

  const filtered = pages?.filter(p => {
    const matchSearch = !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === "all" || p.page_type === filterType;
    return matchSearch && matchType;
  });

  const handleSave = async () => {
    if (!editing?.slug || !editing?.title) {
      toast.error("Slug y título son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug,
        title: editing.title,
        meta_title: editing.meta_title || null,
        meta_description: editing.meta_description || null,
        heading: editing.heading || null,
        body_html: editing.body_html || null,
        city: editing.city || null,
        page_type: editing.page_type || "custom",
        image_url: editing.image_url || null,
        is_active: editing.is_active ?? true,
      };

      if (editing.id) {
        const { error } = await supabase.from("landing_pages").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Página actualizada");
      } else {
        const { error } = await supabase.from("landing_pages").insert(payload);
        if (error) throw error;
        toast.success("Página creada");
      }
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta página?")) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Página eliminada");
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    }
  };

  const handleToggleActive = async (page: LandingPage) => {
    const { error } = await supabase.from("landing_pages").update({ is_active: !page.is_active }).eq("id", page.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
  };

  const handleDuplicate = async (page: LandingPage) => {
    const { id, ...rest } = page;
    const newSlug = `${rest.slug}-copia`;
    const { error } = await supabase.from("landing_pages").insert({ ...rest, slug: newSlug, title: `${rest.title} (Copia)` });
    if (error) toast.error(error.message);
    else {
      toast.success("Página duplicada");
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    }
  };

  const insertSnippet = (html: string) => {
    const current = editing?.body_html || "";
    setEditing(prev => prev ? { ...prev, body_html: current + (current ? "\n\n" : "") + html } : prev);
    setShowSnippets(false);
    toast.success("Snippet insertado");
  };

  const handleExport = () => {
    if (!pages?.length) return;
    const rows = pages.map(p => ({
      slug: p.slug, title: p.title, meta_title: p.meta_title || "",
      meta_description: p.meta_description || "", heading: p.heading || "",
      body_html: p.body_html || "", city: p.city || "", page_type: p.page_type,
      image_url: p.image_url || "", is_active: p.is_active ? "SI" : "NO",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SEO Pages");
    XLSX.writeFile(wb, "seo-pages.xlsx");
    toast.success("Exportado");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
    
    let created = 0, updated = 0;
    for (const row of rows) {
      if (!row.slug || !row.title) continue;
      const payload = {
        slug: String(row.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title: String(row.title),
        meta_title: row.meta_title || null,
        meta_description: row.meta_description || null,
        heading: row.heading || null,
        body_html: row.body_html || null,
        city: row.city || null,
        page_type: row.page_type || "custom",
        image_url: row.image_url || null,
        is_active: row.is_active === "NO" ? false : true,
      };
      const existing = pages?.find(p => p.slug === payload.slug);
      if (existing) {
        await supabase.from("landing_pages").update(payload).eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("landing_pages").insert(payload);
        created++;
      }
    }
    toast.success(`Importación: ${created} creadas, ${updated} actualizadas`);
    queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    e.target.value = "";
  };

  const pageTypes = [
    { value: "all", label: "Todos" },
    { value: "custom", label: "Personalizada" },
    { value: "ciudad", label: "Ciudad" },
    { value: "categoria", label: "Categoría" },
    { value: "marca", label: "Marca" },
    { value: "keyword", label: "Keyword" },
    { value: "seo", label: "SEO" },
    { value: "local", label: "Local" },
  ];

  const seo = editing ? calcSeoScore(editing) : null;

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-heading font-bold">Páginas SEO</h2>
          <p className="text-xs text-muted-foreground">{pages?.length || 0} páginas · Ruta: /s/slug</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
            <FileDown size={14} /> Exportar
          </Button>
          <label>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <span><FileUp size={14} /> Importar</span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
          <Button size="sm" onClick={() => setEditing({ ...emptyPage })} className="gap-1.5">
            <Plus size={14} /> Nueva
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por título o slug..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((p) => {
            const seoInfo = calcSeoScore(p);
            return (
              <div key={p.id} className="flex items-center gap-2 p-3 bg-card rounded-xl border border-border">
                <Globe size={16} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <SeoScoreBadge score={seoInfo.score} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">/s/{p.slug} · {p.page_type}{p.city ? ` · ${p.city}` : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`p-1.5 rounded-lg transition-colors ${p.is_active ? "text-secondary hover:bg-secondary/10" : "text-muted-foreground hover:bg-muted"}`}
                    title={p.is_active ? "Activa — clic para desactivar" : "Inactiva — clic para activar"}
                  >
                    {p.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  {/* View page */}
                  <a
                    href={`/s/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-muted text-primary"
                    title="Ver página"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {/* Duplicate */}
                  <button onClick={() => handleDuplicate(p)} className="p-1.5 hover:bg-muted rounded-lg" title="Duplicar">
                    <Copy size={14} />
                  </button>
                  {/* Edit */}
                  <button onClick={() => setEditing(p)} className="p-1.5 hover:bg-muted rounded-lg">
                    <Pencil size={14} />
                  </button>
                  {/* Delete */}
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {!filtered?.length && <p className="text-center py-8 text-sm text-muted-foreground">No hay páginas que coincidan</p>}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>{editing?.id ? "Editar" : "Nueva"} Página SEO</span>
              {seo && <SeoScoreBadge score={seo.score} />}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="px-4 pb-4 space-y-4">
              {/* SEO Score Tips */}
              {seo && seo.tips.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">💡 Mejoras SEO sugeridas</p>
                  <ul className="text-[11px] text-yellow-600 dark:text-yellow-500 space-y-0.5">
                    {seo.tips.map((t, i) => <li key={i}>• {t}</li>)}
                  </ul>
                </div>
              )}

              {/* Slug + Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Slug (URL) *</label>
                  <Input
                    value={editing.slug || ""}
                    onChange={e => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                    placeholder="domicilios-bucaramanga"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">surteya.com/s/{editing.slug || "..."}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Título *</label>
                  <Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Domicilios en Bucaramanga" />
                </div>
              </div>

              {/* Meta SEO */}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Meta Título</label>
                    <span className={`text-[10px] ${(editing.meta_title?.length || 0) > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                      {editing.meta_title?.length || 0}/60
                    </span>
                  </div>
                  <Input value={editing.meta_title || ""} onChange={e => setEditing({ ...editing, meta_title: e.target.value })} placeholder="Domicilios de alimentos en Bucaramanga | SURTÉ YA" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Meta Descripción</label>
                    <span className={`text-[10px] ${(editing.meta_description?.length || 0) > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                      {editing.meta_description?.length || 0}/160
                    </span>
                  </div>
                  <Textarea value={editing.meta_description || ""} onChange={e => setEditing({ ...editing, meta_description: e.target.value })} placeholder="Pide alimentos a domicilio en Bucaramanga..." rows={2} />
                </div>
              </div>

              {/* Google Preview */}
              {(editing.meta_title || editing.title) && (
                <div className="bg-muted/50 rounded-xl p-3 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">🔍 Vista previa en Google</p>
                  <p className="text-[13px] text-blue-700 dark:text-blue-400 font-medium truncate">
                    {editing.meta_title || editing.title}
                  </p>
                  <p className="text-[11px] text-green-700 dark:text-green-400">
                    surteya.com/s/{editing.slug || "..."}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {editing.meta_description || "Sin descripción configurada..."}
                  </p>
                </div>
              )}

              {/* H1 */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Encabezado H1</label>
                <Input value={editing.heading || ""} onChange={e => setEditing({ ...editing, heading: e.target.value })} placeholder="Título principal visible en la página" />
              </div>

              {/* HTML Content Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Contenido</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowSnippets(!showSnippets)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${showSnippets ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      <LayoutTemplate size={12} /> Snippets {showSnippets ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    <button
                      onClick={() => setEditorTab(editorTab === "visual" ? "code" : "visual")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${editorTab === "code" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      <Code size={12} /> {editorTab === "code" ? "Visual" : "HTML"}
                    </button>
                  </div>
                </div>

                {/* Snippets panel */}
                {showSnippets && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {HTML_SNIPPETS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => insertSnippet(s.html)}
                        className="flex items-center gap-1.5 p-2 rounded-lg border border-border bg-card hover:bg-muted text-left transition-colors"
                      >
                        <s.icon size={14} className="text-accent shrink-0" />
                        <span className="text-[11px] font-medium">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {editorTab === "visual" ? (
                  <TiptapEditor
                    content={editing.body_html || ""}
                    onChange={(html) => setEditing(prev => prev ? { ...prev, body_html: html } : prev)}
                    placeholder="Escribe tu contenido SEO aquí..."
                  />
                ) : (
                  <Textarea
                    value={editing.body_html || ""}
                    onChange={e => setEditing({ ...editing, body_html: e.target.value })}
                    rows={10}
                    placeholder="<p>Contenido HTML para SEO...</p>"
                    className="font-mono text-xs"
                  />
                )}
              </div>

              {/* Type, City, Image */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <Select value={editing.page_type || "custom"} onValueChange={v => setEditing({ ...editing, page_type: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizada</SelectItem>
                      <SelectItem value="ciudad">Ciudad</SelectItem>
                      <SelectItem value="categoria">Categoría</SelectItem>
                      <SelectItem value="marca">Marca</SelectItem>
                      <SelectItem value="keyword">Keyword</SelectItem>
                      <SelectItem value="seo">SEO</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ciudad</label>
                  <Input value={editing.city || ""} onChange={e => setEditing({ ...editing, city: e.target.value })} placeholder="Bucaramanga" className="h-9" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground">Imagen URL</label>
                  <Input value={editing.image_url || ""} onChange={e => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." className="h-9" />
                </div>
              </div>

              {/* Active toggle + Save */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={c => setEditing({ ...editing, is_active: c })} />
                  <span className="text-sm">Activa</span>
                </div>
                <div className="flex gap-2">
                  {editing.id && editing.slug && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/s/${editing.slug}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                        <ExternalLink size={14} /> Ver página
                      </a>
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                    {editing.id ? "Guardar" : "Crear Página"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPagesTab;
