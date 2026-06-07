// Superadmin-only: gestiona plantillas de catálogo por nicho y las aplica a organizaciones.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useOrganization } from "@/context/OrganizationContext";
import { toast } from "sonner";
import { ArrowLeft, Upload, Download, PlayCircle, Plus, Trash2, FileSpreadsheet, ShieldAlert, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

type Template = {
  id: string; niche_key: string; name: string; description: string | null;
  icon_name: string | null; version: number; is_active: boolean; total_items: number;
};

const ITEM_HEADERS = [
  "name","description","brand","category_slug","gtin","sku","unit",
  "suggested_price","suggested_cost","suggested_wholesale","image_url","tags","sort_order",
];

export default function CatalogosBase() {
  const { user, loading } = useAuth();
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const [isSuper, setIsSuper] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login"); return; }
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "superadmin" });
      setIsSuper(!!data);
    })();
  }, [user, loading, navigate]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("catalog_templates").select("*").order("niche_key");
    if (error) { toast.error(error.message); return; }
    setTemplates((data || []) as Template[]);
  };

  useEffect(() => { if (isSuper) loadTemplates(); }, [isSuper]);

  const loadItems = async (t: Template) => {
    setSelected(t);
    const { data } = await supabase.from("catalog_template_items")
      .select("*").eq("template_id", t.id).order("sort_order").limit(500);
    setItems(data || []);
  };

  const downloadTemplate = () => {
    const example = ["Arroz Diana 500g","","Diana","abarrotes","7702001000000","ARR-001","unidad","3500","2800","3200","","arroz,abarrote","0"];
    const ws = XLSX.utils.aoa_to_sheet([ITEM_HEADERS, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "plantilla_catalogo_base.xlsx");
  };

  const exportItems = () => {
    if (!selected) return;
    const rows = items.map(i => ITEM_HEADERS.map(h => h === "tags" ? (i.tags || []).join(",") : (i[h] ?? "")));
    const ws = XLSX.utils.aoa_to_sheet([ITEM_HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selected.niche_key);
    XLSX.writeFile(wb, `${selected.niche_key}_v${selected.version}.xlsx`);
  };

  const importItems = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const headers = (rows[0] || []).map((h: any) => String(h).toLowerCase().trim());
      const payload = rows.slice(1).filter(r => r.some(c => c !== "")).map(r => {
        const o: any = {};
        headers.forEach((h: string, i: number) => { o[h] = r[i]; });
        const num = (v: any) => v === "" || v == null ? null : Number(String(v).replace(/[^0-9.,-]/g,"").replace(",", "."));
        return {
          template_id: selected.id,
          name: String(o.name || "").trim(),
          description: o.description || null,
          brand: o.brand || null,
          category_slug: o.category_slug || null,
          gtin: o.gtin ? String(o.gtin).trim() : null,
          sku: o.sku || null,
          unit: o.unit || "unidad",
          suggested_price: num(o.suggested_price),
          suggested_cost: num(o.suggested_cost),
          suggested_wholesale: num(o.suggested_wholesale),
          image_url: o.image_url || null,
          tags: o.tags ? String(o.tags).split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          sort_order: Number(o.sort_order || 0) || 0,
        };
      }).filter(p => p.name);

      if (!payload.length) throw new Error("Sin filas válidas");
      // Inserción por lotes de 500
      let inserted = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        const { error } = await supabase.from("catalog_template_items").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted} ítems agregados a ${selected.name}`);
      await loadItems(selected);
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Error importando");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearItems = async () => {
    if (!selected) return;
    if (!window.confirm(`¿Borrar TODOS los ítems de "${selected.name}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    const { error } = await supabase.from("catalog_template_items").delete().eq("template_id", selected.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ítems eliminados");
    setItems([]); loadTemplates();
  };

  const bumpVersion = async () => {
    if (!selected) return;
    const { error } = await supabase.from("catalog_templates")
      .update({ version: selected.version + 1 }).eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(`Versión incrementada a v${selected.version + 1}`);
    await loadTemplates();
    setSelected({ ...selected, version: selected.version + 1 });
  };

  const apply = async (mode: "append" | "overwrite_prices") => {
    if (!selected || !currentOrg) { toast.error("Selecciona una organización activa"); return; }
    const msg = mode === "overwrite_prices"
      ? `¿Aplicar "${selected.name}" a ${currentOrg.name} SOBRESCRIBIENDO precios existentes?`
      : `¿Aplicar "${selected.name}" a ${currentOrg.name}? (solo agrega productos faltantes)`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("apply_catalog_template", {
      _org_id: currentOrg.id, _template_id: selected.id, _mode: mode,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r: any = data;
    toast.success(`✓ ${r.created} creados · ${r.updated} actualizados · ${r.skipped} omitidos`);
  };

  if (loading || isSuper === null) {
    return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!isSuper) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <ShieldAlert size={48} className="mx-auto text-destructive" />
          <h1 className="font-heading font-bold text-xl">Acceso restringido</h1>
          <p className="text-sm text-muted-foreground">Solo un superadministrador puede gestionar y aplicar catálogos base.</p>
          <Link to="/admin" className="inline-block text-primary underline text-sm">Volver al panel</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Link to="/admin"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-base">Catálogos Base por Nicho</h1>
          <p className="text-[11px] opacity-80">Solo superadmin · Org activa: {currentOrg?.name || "—"}</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid md:grid-cols-[300px_1fr] gap-4">
        {/* Sidebar nichos */}
        <aside className="space-y-2">
          <h2 className="font-heading font-semibold text-sm">Nichos disponibles</h2>
          {templates.map(t => (
            <button key={t.id} onClick={() => loadItems(t)}
              className={`w-full text-left p-3 rounded-xl border transition ${selected?.id === t.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.name}</span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">v{t.version}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
              <p className="text-[11px] text-accent font-semibold mt-1">{t.total_items} ítems</p>
            </button>
          ))}
        </aside>

        {/* Detalle / acciones */}
        <main className="space-y-4">
          {!selected ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Selecciona un nicho para gestionar sus ítems
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading font-bold text-base">{selected.name} · v{selected.version}</h2>
                    <p className="text-xs text-muted-foreground">{selected.total_items} ítems</p>
                  </div>
                  <button onClick={bumpVersion} className="text-xs bg-muted px-3 py-1.5 rounded-lg">+ Versión</button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-xs font-semibold">
                    <FileSpreadsheet size={14} /> Plantilla XLSX
                  </button>
                  <label className={`flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {busy ? "Cargando…" : "Importar ítems"}
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importItems} className="hidden" />
                  </label>
                  <button onClick={exportItems} disabled={!items.length} className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">
                    <Download size={14} /> Exportar
                  </button>
                  <button onClick={clearItems} disabled={!items.length} className="flex items-center gap-1.5 bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">
                    <Trash2 size={14} /> Vaciar
                  </button>
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Aplicar a organización activa</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Crea los productos del catálogo en <strong>{currentOrg?.name || "—"}</strong>. Match por GTIN, luego nombre+marca.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => apply("append")} disabled={busy || !items.length || !currentOrg}
                      className="flex items-center gap-1.5 bg-accent text-accent-foreground rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50">
                      <PlayCircle size={14} /> Aplicar (solo nuevos)
                    </button>
                    <button onClick={() => apply("overwrite_prices")} disabled={busy || !items.length || !currentOrg}
                      className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50">
                      <PlayCircle size={14} /> Aplicar + Sobrescribir precios
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview ítems */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Vista previa ({items.length})</h3>
                </div>
                <div className="max-h-[60vh] overflow-auto">
                  {items.length === 0 ? (
                    <p className="p-6 text-center text-xs text-muted-foreground">Sin ítems. Importa un XLSX para comenzar.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2">Nombre</th>
                          <th className="text-left p-2">Marca</th>
                          <th className="text-left p-2">GTIN</th>
                          <th className="text-right p-2">Precio</th>
                          <th className="text-right p-2">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.slice(0, 200).map(i => (
                          <tr key={i.id} className="border-t border-border">
                            <td className="p-2">{i.name}</td>
                            <td className="p-2 text-muted-foreground">{i.brand || "—"}</td>
                            <td className="p-2 font-mono text-[10px]">{i.gtin || "—"}</td>
                            <td className="p-2 text-right">${Number(i.suggested_price || 0).toLocaleString("es-CO")}</td>
                            <td className="p-2 text-right text-muted-foreground">${Number(i.suggested_cost || 0).toLocaleString("es-CO")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
