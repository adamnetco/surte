import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const InventoryTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categoryMap = Object.fromEntries((categories || []).map((c: any) => [c.name?.toLowerCase()?.trim(), c.id]));
  const categoryIdMap = Object.fromEntries((categories || []).map((c: any) => [c.id, c.name]));

  const HEADERS = [
    "id", "name", "description", "price", "original_price", "price_wholesale", "price_distributor",
    "cost_price", "stock", "unit", "category", "brand", "sku", "gtin", "weight",
    "is_active", "is_fresh", "is_wholesale", "slug", "meta_title", "meta_description", "image_url", "tags",
  ];

  const productToRow = (p: any) => [
    p.id, p.name, p.description || "", p.price, p.original_price || "", p.price_wholesale || "",
    p.price_distributor || "", p.cost_price || "", p.stock, p.unit || "unidad",
    categoryIdMap[p.category_id] || "", p.brand || "", p.sku || "", p.gtin || "",
    p.weight || "", p.is_active !== false ? "TRUE" : "FALSE", p.is_fresh ? "TRUE" : "FALSE",
    p.is_wholesale ? "TRUE" : "FALSE", p.slug || "", p.meta_title || "", p.meta_description || "",
    p.image_url || "", (p.tags || []).join(", "),
  ];

  const downloadCSV = () => {
    const rows = (products || []).map(productToRow);
    const csvContent = [HEADERS, ...rows]
      .map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `inventario_surte_${dateStr()}.csv`);
    toast.success(`${rows.length} productos exportados`);
  };

  const downloadXLS = () => {
    const rows = (products || []).map(productToRow);
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, `inventario_surte_${dateStr()}.xlsx`);
    toast.success(`${rows.length} productos exportados (Excel)`);
  };

  const downloadGMC = () => {
    const headers = [
      "id", "title", "description", "link", "image_link", "availability", "price",
      "sale_price", "brand", "condition", "product_type", "gtin", "mpn", "shipping_weight",
    ];
    const rows = (products || []).filter((p: any) => p.is_active !== false).map((p: any) => [
      p.id, p.name, p.description || p.name, `https://surteya.com/producto/${p.slug || p.id}`,
      p.image_url || "", p.stock > 0 ? "in_stock" : "out_of_stock", `${p.price} COP`,
      p.original_price ? `${p.price} COP` : "", p.brand || "SURTÉ YA", "new",
      categoryIdMap[p.category_id] || "Alimentos", p.gtin || "", p.sku || "", p.weight || "",
    ]);
    const tsvContent = [headers, ...rows].map((row) => row.map((v: any) => String(v).replace(/\t/g, " ")).join("\t")).join("\n");
    downloadBlob(new Blob(["\uFEFF" + tsvContent], { type: "text/tab-separated-values;charset=utf-8;" }), `google_merchant_surte_${dateStr()}.tsv`);
    toast.success(`${rows.length} productos exportados para Google Merchant Center`);
  };

  const downloadTemplate = () => {
    const example = [
      "", "Salsa de Tomate 500g", "Salsa artesanal premium", "8500", "10000", "7500", "6800",
      "5000", "100", "unidad", "Salsas", "SURTÉ YA", "SAL-001", "7701234567890", "500g",
      "TRUE", "FALSE", "FALSE", "salsa-de-tomate-500g", "Salsa de Tomate 500g - SURTÉ YA", "Salsa de tomate artesanal", "", "salsa, tomate, artesanal",
    ];
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, example]);
    ws["!cols"] = HEADERS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_productos_surte.xlsx");
  };

  const dateStr = () => new Date().toISOString().slice(0, 10);
  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const parseFile = async (file: File): Promise<Record<string, string>[]> => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (ext === "xlsx" || ext === "xls") {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (rows.length < 2) throw new Error("El archivo no contiene datos");
      const headers = rows[0].map((h: any) => String(h).toLowerCase().replace(/\s+/g, "_").trim());
      return rows.slice(1).filter((r: any[]) => r.some((c: any) => c !== "")).map((row: any[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, idx: number) => { obj[h] = String(row[idx] ?? ""); });
        return obj;
      });
    }
    
    // CSV/TSV text parsing
    const text = await file.text();
    const delimiter = text.includes("\t") ? "\t" : ",";
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("El archivo no contiene datos");
    
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else { current += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === delimiter) { result.push(current.trim()); current = ""; }
          else { current += ch; }
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_").replace(/^\uFEFF/, "").trim());
    return lines.slice(1).map((line) => {
      const vals = parseRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
      return obj;
    }).filter((obj) => Object.values(obj).some((v) => v !== ""));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const dataRows = await parseFile(file);
      if (dataRows.length === 0) throw new Error("El archivo no contiene datos válidos");

      let created = 0, updated = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const obj = dataRows[i];
        const rowNum = i + 2;

        const name = obj.name || obj.nombre;
        if (!name) { errors.push(`Fila ${rowNum}: sin nombre`); continue; }

        const rawPrice = (obj.price || obj.precio || "").replace(/[^0-9.,]/g, "").replace(",", ".");
        const price = Number(rawPrice);
        if (!price || isNaN(price)) { errors.push(`Fila ${rowNum}: "${name}" sin precio válido (${obj.price || obj.precio})`); continue; }

        const catName = (obj.category || obj.categoria || "").toLowerCase().trim();
        const catId = categoryMap[catName] || null;

        const slug = (obj.slug || name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const parseBool = (v: string, def: boolean) => {
          const lower = v.toLowerCase().trim();
          if (!lower) return def;
          return lower === "true" || lower === "si" || lower === "sí" || lower === "1" || lower === "yes";
        };

        const parseNum = (v: string) => {
          if (!v) return null;
          const cleaned = v.replace(/[^0-9.,]/g, "").replace(",", ".");
          const n = Number(cleaned);
          return isNaN(n) ? null : n;
        };

        const tagsStr = obj.tags || obj.etiquetas || "";
        const tags = tagsStr ? tagsStr.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

        const payload: any = {
          name,
          description: obj.description || obj.descripcion || null,
          price,
          original_price: parseNum(obj.original_price || obj.precio_original || ""),
          price_wholesale: parseNum(obj.price_wholesale || obj.precio_mayorista || ""),
          price_distributor: parseNum(obj.price_distributor || obj.precio_distribuidor || ""),
          cost_price: parseNum(obj.cost_price || obj.costo || ""),
          stock: Number(obj.stock || obj.inventario || 0) || 0,
          unit: obj.unit || obj.unidad || "unidad",
          category_id: catId,
          brand: obj.brand || obj.marca || null,
          sku: obj.sku || null,
          gtin: obj.gtin || obj.ean || null,
          weight: obj.weight || obj.peso || null,
          is_active: parseBool(obj.is_active || obj.activo || "", true),
          is_fresh: parseBool(obj.is_fresh || obj.fresco || "", false),
          is_wholesale: parseBool(obj.is_wholesale || obj.mayorista || "", false),
          slug,
          meta_title: obj.meta_title || null,
          meta_description: obj.meta_description || null,
          image_url: obj.image_url || obj.imagen || null,
          tags,
        };

        if (obj.id && obj.id.length > 10) {
          const { error } = await supabase.from("products").update(payload).eq("id", obj.id);
          if (error) { errors.push(`Fila ${rowNum}: ${error.message}`); continue; }
          updated++;
        } else {
          if (!currentOrg?.id) { errors.push(`Fila ${rowNum}: Selecciona una organización antes de importar`); continue; }
          const { error } = await supabase.from("products").insert({ ...payload, organization_id: currentOrg.id });
          if (error) { errors.push(`Fila ${rowNum}: ${error.message}`); continue; }
          created++;
        }
      }

      setImportResult({ created, updated, errors });
      if (created + updated > 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast.success(`${created} creados, ${updated} actualizados`);
      }
      if (errors.length > 0) {
        toast.warning(`${errors.length} error(es) durante la importación`);
      }
    } catch (err: any) {
      toast.error(err.message || "Error importando archivo");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-lg text-foreground">Inventario — Importar / Exportar</h2>
      <p className="text-xs text-muted-foreground">Gestiona tus productos de forma masiva usando archivos CSV o Excel (.xlsx).</p>

      {/* Export */}
      <div className="bg-card rounded-xl p-4 border border-border space-y-3">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <Download size={16} className="text-accent" /> Exportar Inventario
        </h3>
        <p className="text-xs text-muted-foreground">{products?.length || 0} productos disponibles para exportar.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadCSV} className="flex-1 min-w-[100px] bg-secondary text-secondary-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button onClick={downloadXLS} className="flex-1 min-w-[100px] bg-accent text-accent-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={downloadGMC} className="flex-1 min-w-[100px] bg-primary text-primary-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <FileSpreadsheet size={14} /> Google Merchant
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-card rounded-xl p-4 border border-border space-y-3">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <Upload size={16} className="text-accent" /> Importar Productos
        </h3>
        <p className="text-xs text-muted-foreground">
          Sube un archivo <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong>. Si incluyes la columna <code className="bg-muted px-1 py-0.5 rounded text-[10px]">id</code>, los productos existentes se actualizarán.
        </p>
        <div className="flex gap-2">
          <label className={`flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {importing ? "Importando..." : "Subir Archivo"}
            <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.tsv,.txt" onChange={handleImport} className="hidden" disabled={importing} />
          </label>
          <button onClick={downloadTemplate} className="bg-muted text-muted-foreground rounded-xl py-2.5 px-4 text-xs font-medium hover:bg-muted/80 transition-colors">
            📋 Plantilla
          </button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="bg-card rounded-xl p-4 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-sm">Resultado de Importación</h3>
            <button onClick={() => setImportResult(null)}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1 text-secondary"><CheckCircle2 size={14} /> {importResult.created} creados</span>
            <span className="flex items-center gap-1 text-accent"><CheckCircle2 size={14} /> {importResult.updated} actualizados</span>
          </div>
          {importResult.errors.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-destructive flex items-center gap-1"><AlertTriangle size={12} /> {importResult.errors.length} errores:</p>
              {importResult.errors.map((err, i) => (
                <p key={i} className="text-[11px] text-muted-foreground bg-destructive/5 rounded px-2 py-1">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-2">
        <h4 className="font-heading font-semibold text-xs text-foreground">📖 Instrucciones</h4>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
          <li>Descarga la <strong>plantilla (.xlsx)</strong> como referencia para los nombres de columnas.</li>
          <li>La columna <strong>category</strong> debe coincidir exactamente con el nombre de la categoría.</li>
          <li>Los campos booleanos aceptan: TRUE/FALSE, SI/NO, 1/0.</li>
          <li>Los precios deben ser numéricos (ej: 8500, no $8.500).</li>
          <li>Soporta archivos <strong>.xlsx, .xls, .csv y .tsv</strong>.</li>
          <li>La columna <strong>tags</strong> acepta etiquetas separadas por coma (ej: "salsa, tomate, artesanal").</li>
          <li>Para actualizar productos existentes, incluye la columna <strong>id</strong> con el UUID.</li>
        </ul>
      </div>
    </div>
  );
};

export default InventoryTab;
