import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Pencil, Trash2, Globe, Eye, EyeOff, Loader2, ExternalLink,
  Copy, Search, FileDown, FileUp, CheckCircle2, AlertTriangle, Type,
  Image, List, Code, LayoutTemplate, ChevronDown, ChevronUp, Sparkles,
  Download, Upload, X, Check, FileText, Zap, Package
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
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { scopedFrom } from "@/modules/tenant/lib/tenantScope";

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

// Quick templates for fast page creation
const PAGE_TEMPLATES = [
  {
    label: "Ciudad",
    icon: "🏙️",
    template: (city: string) => ({
      slug: `domicilios-${city.toLowerCase().replace(/\s/g, "-")}`,
      title: `Domicilios en ${city}`,
      meta_title: `Domicilios en ${city} | Pedidos online`,
      meta_description: `Pide a domicilio en ${city}. Envío rápido, precios competitivos. Pedidos por WhatsApp.`,
      heading: `Domicilios en ${city}`,
      page_type: "ciudad",
      city,
      is_active: true,
      body_html: `<section>\n  <h2>Domicilios en ${city}</h2>\n  <p>Ofrecemos servicio de domicilios en ${city}. Productos de calidad con entrega rápida.</p>\n</section>\n\n<section>\n  <h2>¿Por qué elegirnos en ${city}?</h2>\n  <ul>\n    <li><strong>Envíos rápidos</strong> - Entrega en 24-48 horas</li>\n    <li><strong>Precios competitivos</strong> - Los mejores precios del mercado</li>\n    <li><strong>Calidad garantizada</strong> - Productos certificados</li>\n  </ul>\n</section>\n\n<section>\n  <h2>Preguntas Frecuentes</h2>\n  <details>\n    <summary><strong>¿Cuál es el pedido mínimo en ${city}?</strong></summary>\n    <p>El pedido mínimo varía según tu zona. Consulta las condiciones en nuestra página de envíos.</p>\n  </details>\n</section>`,
    }),
  },
  {
    label: "Categoria",
    icon: "📦",
    template: (cat: string) => ({
      slug: `${cat.toLowerCase().replace(/\s/g, "-")}-al-por-mayor`,
      title: `${cat} al por mayor - Precios mayoristas`,
      meta_title: `${cat} al por mayor | Precios mayoristas`,
      meta_description: `Compra ${cat.toLowerCase()} al por mayor con precios competitivos. Envío rápido. Calidad garantizada.`,
      heading: `${cat} al por mayor`,
      page_type: "categoria",
      is_active: true,
      body_html: `<section>\n  <h2>${cat} al por mayor</h2>\n  <p>Encuentra los mejores <strong>${cat.toLowerCase()}</strong> al por mayor. Precios competitivos para restaurantes, hoteles y minimercados.</p>\n</section>`,
    }),
  },
  {
    label: "Keyword SEO",
    icon: "🔍",
    template: (kw: string) => ({
      slug: kw.toLowerCase().replace(/\s/g, "-"),
      title: kw,
      meta_title: `${kw}`,
      meta_description: `${kw}. Los mejores precios y calidad. Envío rápido.`,
      heading: kw,
      page_type: "keyword",
      is_active: true,
      body_html: `<section>\n  <h2>${kw}</h2>\n  <p>Contenido optimizado para <strong>${kw.toLowerCase()}</strong>. Edita este contenido con información relevante.</p>\n</section>`,
    }),
  },
];

// Import row validation
interface ImportRow {
  slug: string;
  title: string;
  meta_title?: string;
  meta_description?: string;
  heading?: string;
  body_html?: string;
  city?: string;
  page_type?: string;
  image_url?: string;
  is_active?: string | boolean;
  _status?: "new" | "update" | "error";
  _error?: string;
}

const REQUIRED_COLUMNS = ["slug", "title"];
const OPTIONAL_COLUMNS = ["meta_title", "meta_description", "heading", "body_html", "city", "page_type", "image_url", "is_active"];

const HTML_SNIPPETS = [
  { label: "Parrafo SEO", icon: Type, html: `<p class="text-lg leading-relaxed">Escribe aqui tu contenido optimizado para SEO con palabras clave relevantes para tu negocio.</p>` },
  { label: "Lista de beneficios", icon: List, html: `<h2>Por que elegirnos?</h2>\n<ul>\n  <li><strong>Envios rapidos</strong> - Entrega en 24-48 horas</li>\n  <li><strong>Precios mayoristas</strong> - Los mejores precios del mercado</li>\n  <li><strong>Calidad garantizada</strong> - Productos frescos y certificados</li>\n  <li><strong>Atencion personalizada</strong> - Soporte por WhatsApp</li>\n</ul>` },
  { label: "CTA con enlace", icon: ExternalLink, html: `<div style="text-align:center;margin:2rem 0">\n  <a href="/catalogo" style="display:inline-block;background:#F37021;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Catalogo Completo</a>\n</div>` },
  { label: "Imagen con caption", icon: Image, html: `<figure>\n  <img src="URL_DE_IMAGEN" alt="Descripcion de la imagen" style="width:100%;border-radius:12px" loading="lazy" />\n  <figcaption style="text-align:center;font-size:0.875rem;color:#666;margin-top:0.5rem">Pie de foto descriptivo</figcaption>\n</figure>` },
  { label: "Seccion H2 + texto", icon: LayoutTemplate, html: `<section>\n  <h2>Titulo de Seccion</h2>\n  <p>Contenido descriptivo con <strong>palabras clave</strong> relevantes para posicionamiento local.</p>\n</section>` },
  { label: "FAQ Schema", icon: Code, html: `<section>\n  <h2>Preguntas Frecuentes</h2>\n  <details>\n    <summary><strong>¿Cuál es el pedido mínimo?</strong></summary>\n    <p>El pedido mínimo varía según tu ciudad.</p>\n  </details>\n  <details>\n    <summary><strong>¿Hacen envíos a toda la región?</strong></summary>\n    <p>Sí, realizamos envíos a múltiples municipios. Consulta las zonas disponibles.</p>\n  </details>\n</section>` },
];

const calcSeoScore = (page: Partial<LandingPage>): { score: number; tips: string[] } => {
  const tips: string[] = [];
  let score = 0;
  if (page.meta_title && page.meta_title.length >= 30 && page.meta_title.length <= 60) score += 20;
  else tips.push("Meta titulo: 30-60 caracteres ideal");
  if (page.meta_description && page.meta_description.length >= 120 && page.meta_description.length <= 160) score += 20;
  else tips.push("Meta descripcion: 120-160 caracteres ideal");
  if (page.heading && page.heading.length > 10) score += 15;
  else tips.push("Anade un H1 descriptivo (>10 chars)");
  if (page.body_html && page.body_html.length > 200) score += 15;
  else tips.push("Contenido HTML minimo 200 caracteres");
  if (page.body_html && /<h2/i.test(page.body_html)) score += 10;
  else tips.push("Incluye al menos un <h2> en el contenido");
  if (page.image_url) score += 10;
  else tips.push("Anade una imagen destacada");
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
  const { currentOrg } = useOrganization();
  const [editing, setEditing] = useState<Partial<LandingPage> | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showSnippets, setShowSnippets] = useState(false);
  const [editorTab, setEditorTab] = useState<"visual" | "code">("visual");

  // Import preview state
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);

  // Template wizard
  const [templateWizard, setTemplateWizard] = useState<{ type: number; input: string } | null>(null);

  // Product linking
  const [productSearch, setProductSearch] = useState("");
  const [linkedProducts, setLinkedProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const { data: allProducts } = useQuery({
    queryKey: ["all_products_for_linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, price, slug")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Load linked products when editing a page
  const loadLinkedProducts = useCallback(async (pageId: string) => {
    setLoadingProducts(true);
    const { data } = await supabase
      .from("landing_page_products")
      .select("product_id")
      .eq("landing_page_id", pageId)
      .order("sort_order");
    setLinkedProducts(data?.map((r: any) => r.product_id) || []);
    setLoadingProducts(false);
  }, []);

  const toggleProduct = useCallback((productId: string) => {
    setLinkedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const saveLinkedProducts = useCallback(async (pageId: string) => {
    // landing_page_products no tiene organization_id; scope implícito vía landing_page_id (RLS).
    await supabase.from("landing_page_products").delete().eq("landing_page_id", pageId);
    if (linkedProducts.length > 0) {
      const rows = linkedProducts.map((product_id, i) => ({
        landing_page_id: pageId,
        product_id,
        sort_order: i,
      }));
      await supabase.from("landing_page_products").insert(rows);
    }
    queryClient.invalidateQueries({ queryKey: ["landing_page_products"] });
  }, [linkedProducts, queryClient]);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing_pages", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await scopedFrom("landing_pages", currentOrg!.id).order("sort_order");
      if (error) throw error;
      return data as LandingPage[];
    },
  });

  const filtered = useMemo(() => pages?.filter(p => {
    const matchSearch = !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === "all" || p.page_type === filterType;
    return matchSearch && matchType;
  }), [pages, searchTerm, filterType]);

  const handleSave = async () => {
    if (!editing?.slug || !editing?.title) {
      toast.error("Slug y titulo son obligatorios");
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
      let pageId = editing.id;
      if (editing.id) {
        const { error } = await supabase.from("landing_pages").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { data: inserted, error } = await supabase.from("landing_pages").insert({ ...payload, organization_id: currentOrg.id }).select("id").single();
        if (error) throw error;
        pageId = inserted.id;
      }
      // Save linked products
      if (pageId) {
        await saveLinkedProducts(pageId);
      }
      toast.success(editing.id ? "Pagina actualizada" : "Pagina creada");
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar esta pagina?")) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pagina eliminada");
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    }
  };

  const handleToggleActive = async (page: LandingPage) => {
    const { error } = await supabase.from("landing_pages").update({ is_active: !page.is_active }).eq("id", page.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
  };

  const handleDuplicate = async (page: LandingPage) => {
    if (!confirm(`¿Duplicar la página "${page.title}"?\nSe creará una copia con slug: ${page.slug}-copia`)) return;
    if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
    const { id, ...rest } = page;
    const newSlug = `${rest.slug}-copia`;
    const { error } = await supabase.from("landing_pages").insert({ ...rest, slug: newSlug, title: `${rest.title} (Copia)`, organization_id: currentOrg.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Pagina duplicada");
      queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    }
  };

  const insertSnippet = (html: string) => {
    const current = editing?.body_html || "";
    setEditing(prev => prev ? { ...prev, body_html: current + (current ? "\n\n" : "") + html } : prev);
    setShowSnippets(false);
    toast.success("Snippet insertado");
  };

  // ── EXPORT ──
  const handleExport = (format: "xlsx" | "csv") => {
    if (!pages?.length) return;
    const rows = pages.map(p => ({
      slug: p.slug,
      title: p.title,
      meta_title: p.meta_title || "",
      meta_description: p.meta_description || "",
      heading: p.heading || "",
      body_html: p.body_html || "",
      city: p.city || "",
      page_type: p.page_type,
      image_url: p.image_url || "",
      is_active: p.is_active ? "SI" : "NO",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key]).length).slice(0, 20)) + 2,
    }));
    ws["!cols"] = colWidths.map(w => ({ wch: Math.min(w.wch, 50) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SEO Pages");

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "seo-pages.csv"; a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, "seo-pages.xlsx");
    }
    toast.success(`Exportado como ${format.toUpperCase()}`);
  };

  const handleExportTemplate = () => {
    const templateRow = {
      slug: "ejemplo-slug",
      title: "Titulo de ejemplo",
      meta_title: "Meta titulo | SURTE YA",
      meta_description: "Meta descripcion de 120-160 caracteres para SEO",
      heading: "Encabezado H1",
      body_html: "<h2>Seccion</h2><p>Contenido</p>",
      city: "Bucaramanga",
      page_type: "custom",
      image_url: "",
      is_active: "SI",
    };
    const ws = XLSX.utils.json_to_sheet([templateRow]);
    ws["!cols"] = Object.keys(templateRow).map(k => ({ wch: Math.max(k.length + 2, 20) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "seo-pages-template.xlsx");
    toast.success("Plantilla descargada");
  };

  // ── IMPORT WITH PREVIEW ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const rawRows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);

      if (!rawRows.length) {
        toast.error("El archivo esta vacio");
        e.target.value = "";
        return;
      }

      // Validate columns
      const columns = Object.keys(rawRows[0]);
      const missingRequired = REQUIRED_COLUMNS.filter(c => !columns.includes(c));
      if (missingRequired.length) {
        toast.error(`Columnas faltantes: ${missingRequired.join(", ")}`);
        e.target.value = "";
        return;
      }

      // Validate rows and detect new vs update
      const validated: ImportRow[] = rawRows.map(row => {
        const slug = String(row.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const title = String(row.title || "").trim();

        if (!slug || !title) {
          return { ...row, slug, title, _status: "error" as const, _error: "Slug o titulo vacio" };
        }
        if (slug.length < 3) {
          return { ...row, slug, title, _status: "error" as const, _error: "Slug muy corto (min 3)" };
        }

        const existing = pages?.find(p => p.slug === slug);
        return {
          slug,
          title,
          meta_title: row.meta_title || "",
          meta_description: row.meta_description || "",
          heading: row.heading || "",
          body_html: row.body_html || "",
          city: row.city || "",
          page_type: row.page_type || "custom",
          image_url: row.image_url || "",
          is_active: row.is_active,
          _status: existing ? "update" as const : "new" as const,
        };
      });

      setImportPreview(validated);
    } catch (err: any) {
      toast.error(`Error al leer archivo: ${err.message}`);
    }
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const validRows = importPreview.filter(r => r._status !== "error");
    if (!validRows.length) {
      toast.error("No hay filas validas para importar");
      return;
    }

    setImporting(true);
    let created = 0, updated = 0, errors = 0;

    for (const row of validRows) {
      const payload = {
        slug: row.slug,
        title: row.title,
        meta_title: row.meta_title || null,
        meta_description: row.meta_description || null,
        heading: row.heading || null,
        body_html: row.body_html || null,
        city: row.city || null,
        page_type: row.page_type || "custom",
        image_url: row.image_url || null,
        is_active: row.is_active === "NO" ? false : true,
      };

      try {
        if (row._status === "update") {
          const existing = pages?.find(p => p.slug === row.slug);
          if (existing) {
            const { error } = await supabase.from("landing_pages").update(payload).eq("id", existing.id);
            if (error) throw error;
            updated++;
          }
        } else {
          if (!currentOrg?.id) { errors++; continue; }
          const { error } = await supabase.from("landing_pages").insert({ ...payload, organization_id: currentOrg.id });
          if (error) throw error;
          created++;
        }
      } catch {
        errors++;
      }
    }

    toast.success(`Importacion: ${created} creadas, ${updated} actualizadas${errors ? `, ${errors} errores` : ""}`);
    queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
    setImportPreview(null);
    setImportFileName("");
    setImporting(false);
  };

  // ── TEMPLATE WIZARD ──
  const handleCreateFromTemplate = () => {
    if (!templateWizard || !templateWizard.input.trim()) {
      toast.error("Escribe un valor");
      return;
    }
    const tpl = PAGE_TEMPLATES[templateWizard.type];
    const generated = tpl.template(templateWizard.input.trim());
    setEditing({ ...emptyPage, ...generated });
    setTemplateWizard(null);
  };

  const pageTypes = [
    { value: "all", label: "Todos" },
    { value: "custom", label: "Personalizada" },
    { value: "ciudad", label: "Ciudad" },
    { value: "categoria", label: "Categoria" },
    { value: "marca", label: "Marca" },
    { value: "keyword", label: "Keyword" },
    { value: "seo", label: "SEO" },
    { value: "local", label: "Local" },
  ];

  const seo = editing ? calcSeoScore(editing) : null;

  // Stats
  const stats = useMemo(() => {
    if (!pages) return { total: 0, active: 0, avgSeo: 0 };
    const active = pages.filter(p => p.is_active).length;
    const avgSeo = pages.length ? Math.round(pages.reduce((s, p) => s + calcSeoScore(p).score, 0) / pages.length) : 0;
    return { total: pages.length, active, avgSeo };
  }, [pages]);

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-heading font-bold">Paginas SEO</h2>
          <p className="text-xs text-muted-foreground">
            {stats.total} paginas · {stats.active} activas · SEO promedio: <SeoScoreBadge score={stats.avgSeo} />
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ ...emptyPage })} className="gap-1.5">
          <Plus size={14} /> Nueva
        </Button>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex gap-2 flex-wrap">
        {/* Templates */}
        {PAGE_TEMPLATES.map((tpl, i) => (
          <button
            key={i}
            onClick={() => setTemplateWizard({ type: i, input: "" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition-colors"
          >
            <span>{tpl.icon}</span> {tpl.label}
          </button>
        ))}
        <div className="flex-1" />
        {/* Import / Export */}
        <Button size="sm" variant="outline" onClick={handleExportTemplate} className="gap-1.5 text-xs h-8">
          <Download size={13} /> Plantilla
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleExport("xlsx")} className="gap-1.5 text-xs h-8">
          <FileDown size={13} /> XLSX
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleExport("csv")} className="gap-1.5 text-xs h-8">
          <FileDown size={13} /> CSV
        </Button>
        <label>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" asChild>
            <span><FileUp size={13} /> Importar</span>
          </Button>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
        </label>
      </div>

      {/* Template Wizard Dialog */}
      <Dialog open={!!templateWizard} onOpenChange={o => !o && setTemplateWizard(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              Crear desde plantilla: {templateWizard !== null && PAGE_TEMPLATES[templateWizard.type]?.label}
            </DialogTitle>
          </DialogHeader>
          {templateWizard && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {templateWizard.type === 0 ? "Nombre de la ciudad" :
                   templateWizard.type === 1 ? "Nombre de la categoria" :
                   "Palabra clave"}
                </label>
                <Input
                  value={templateWizard.input}
                  onChange={e => setTemplateWizard({ ...templateWizard, input: e.target.value })}
                  placeholder={templateWizard.type === 0 ? "Bucaramanga" : templateWizard.type === 1 ? "Pulpas de fruta" : "salsas para restaurantes"}
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleCreateFromTemplate()}
                />
              </div>
              {templateWizard.input.trim() && (
                <div className="bg-muted/50 rounded-lg p-2 text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Vista previa:</p>
                  <p>Slug: <code className="bg-muted px-1 rounded">{PAGE_TEMPLATES[templateWizard.type].template(templateWizard.input.trim()).slug}</code></p>
                  <p>Titulo: {PAGE_TEMPLATES[templateWizard.type].template(templateWizard.input.trim()).title}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setTemplateWizard(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleCreateFromTemplate} className="gap-1.5">
                  <Sparkles size={13} /> Generar y editar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={o => !o && setImportPreview(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={16} className="text-accent" />
              Vista previa de importacion
            </DialogTitle>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Archivo: <strong>{importFileName}</strong> · {importPreview.length} filas
              </p>

              {/* Summary */}
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-secondary">
                  <Plus size={12} /> {importPreview.filter(r => r._status === "new").length} nuevas
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Pencil size={12} /> {importPreview.filter(r => r._status === "update").length} actualizaciones
                </span>
                {importPreview.some(r => r._status === "error") && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle size={12} /> {importPreview.filter(r => r._status === "error").length} errores
                  </span>
                )}
              </div>

              {/* Rows */}
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {importPreview.map((row, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                    row._status === "error" ? "border-destructive/30 bg-destructive/5" :
                    row._status === "update" ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20" :
                    "border-secondary/30 bg-secondary/5"
                  }`}>
                    {row._status === "error" ? <X size={14} className="text-destructive shrink-0" /> :
                     row._status === "update" ? <Pencil size={14} className="text-blue-600 shrink-0" /> :
                     <Check size={14} className="text-secondary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{row.title || "(sin titulo)"}</p>
                      <p className="text-muted-foreground truncate">/s/{row.slug} {row.city ? `· ${row.city}` : ""}</p>
                    </div>
                    {row._status === "error" && <p className="text-destructive text-[10px]">{row._error}</p>}
                    {row._status === "update" && <span className="text-blue-600 text-[10px] font-medium">Actualizar</span>}
                    {row._status === "new" && <span className="text-secondary text-[10px] font-medium">Nueva</span>}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { setImportPreview(null); setImportFileName(""); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={importing || !importPreview.some(r => r._status !== "error")}
                  className="gap-1.5"
                >
                  {importing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Importar {importPreview.filter(r => r._status !== "error").length} paginas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por titulo o slug..."
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
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`p-1.5 rounded-lg transition-colors ${p.is_active ? "text-secondary hover:bg-secondary/10" : "text-muted-foreground hover:bg-muted"}`}
                    title={p.is_active ? "Activa" : "Inactiva"}
                  >
                    {p.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <a href={`/s/${p.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-muted text-primary" title="Ver pagina">
                    <ExternalLink size={14} />
                  </a>
                  <button onClick={() => handleDuplicate(p)} className="p-1.5 hover:bg-muted rounded-lg" title="Duplicar">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => { setEditing(p); loadLinkedProducts(p.id); }} className="p-1.5 hover:bg-muted rounded-lg">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {!filtered?.length && (
            <div className="text-center py-12 space-y-3">
              <FileText size={32} className="mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No hay paginas SEO</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => setEditing({ ...emptyPage })} className="gap-1.5">
                  <Plus size={14} /> Crear pagina
                </Button>
                <label>
                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                    <span><FileUp size={14} /> Importar</span>
                  </Button>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>{editing?.id ? "Editar" : "Nueva"} Pagina SEO</span>
              {seo && <SeoScoreBadge score={seo.score} />}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="px-4 pb-4 space-y-4">
              {seo && seo.tips.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Mejoras SEO sugeridas</p>
                  <ul className="text-[11px] text-yellow-600 dark:text-yellow-500 space-y-0.5">
                    {seo.tips.map((t, i) => <li key={i}>- {t}</li>)}
                  </ul>
                </div>
              )}

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
                  <label className="text-xs font-medium text-muted-foreground">Titulo *</label>
                  <Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Domicilios en Bucaramanga" />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Meta Titulo</label>
                    <span className={`text-[10px] ${(editing.meta_title?.length || 0) > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                      {editing.meta_title?.length || 0}/60
                    </span>
                  </div>
                  <Input value={editing.meta_title || ""} onChange={e => setEditing({ ...editing, meta_title: e.target.value })} placeholder="Domicilios de alimentos en Bucaramanga | SURTE YA" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Meta Descripcion</label>
                    <span className={`text-[10px] ${(editing.meta_description?.length || 0) > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                      {editing.meta_description?.length || 0}/160
                    </span>
                  </div>
                  <Textarea value={editing.meta_description || ""} onChange={e => setEditing({ ...editing, meta_description: e.target.value })} placeholder="Pide alimentos a domicilio en Bucaramanga..." rows={2} />
                </div>
              </div>

              {(editing.meta_title || editing.title) && (
                <div className="bg-muted/50 rounded-xl p-3 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Vista previa en Google</p>
                  <p className="text-[13px] text-blue-700 dark:text-blue-400 font-medium truncate">
                    {editing.meta_title || editing.title}
                  </p>
                  <p className="text-[11px] text-green-700 dark:text-green-400">
                    surteya.com/s/{editing.slug || "..."}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {editing.meta_description || "Sin descripcion configurada..."}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Encabezado H1</label>
                <Input value={editing.heading || ""} onChange={e => setEditing({ ...editing, heading: e.target.value })} placeholder="Titulo principal visible en la pagina" />
              </div>

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
                    placeholder="Escribe tu contenido SEO aqui..."
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <Select value={editing.page_type || "custom"} onValueChange={v => setEditing({ ...editing, page_type: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Personalizada</SelectItem>
                      <SelectItem value="ciudad">Ciudad</SelectItem>
                      <SelectItem value="categoria">Categoria</SelectItem>
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

              {/* Product Linking */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Package size={12} /> Productos relacionados ({linkedProducts.length})
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Buscar productos para vincular..."
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                {loadingProducts ? (
                  <div className="text-center py-3"><Loader2 size={16} className="animate-spin mx-auto text-muted-foreground" /></div>
                ) : (
                  <>
                    {/* Selected products */}
                    {linkedProducts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {linkedProducts.map(id => {
                          const prod = allProducts?.find(p => p.id === id);
                          if (!prod) return null;
                          return (
                            <span key={id} className="inline-flex items-center gap-1 bg-accent/10 text-accent text-[10px] font-medium px-2 py-1 rounded-lg">
                              {prod.name.slice(0, 25)}{prod.name.length > 25 ? "…" : ""}
                              <button onClick={() => toggleProduct(id)} className="hover:text-destructive"><X size={10} /></button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {/* Product search results */}
                    {productSearch.trim() && (
                      <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                        {allProducts
                          ?.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.slug?.toLowerCase().includes(productSearch.toLowerCase()))
                          .slice(0, 20)
                          .map(p => (
                            <button
                              key={p.id}
                              onClick={() => toggleProduct(p.id)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted transition-colors ${linkedProducts.includes(p.id) ? "bg-accent/5" : ""}`}
                            >
                              {p.image_url ? (
                                <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-7 h-7 bg-muted rounded shrink-0" />
                              )}
                              <span className="flex-1 truncate">{p.name}</span>
                              {linkedProducts.includes(p.id) ? (
                                <CheckCircle2 size={14} className="text-accent shrink-0" />
                              ) : (
                                <Plus size={14} className="text-muted-foreground shrink-0" />
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={c => setEditing({ ...editing, is_active: c })} />
                  <span className="text-sm">Activa</span>
                </div>
                <div className="flex gap-2">
                  {editing.id && editing.slug && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/s/${editing.slug}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                        <ExternalLink size={14} /> Ver pagina
                      </a>
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                    {editing.id ? "Guardar" : "Crear Pagina"}
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
