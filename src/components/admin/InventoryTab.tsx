import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

const InventoryTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categoryMap = Object.fromEntries((categories || []).map((c: any) => [c.name?.toLowerCase(), c.id]));
  const categoryIdMap = Object.fromEntries((categories || []).map((c: any) => [c.id, c.name]));

  const downloadCSV = () => {
    const headers = [
      "id", "name", "description", "price", "original_price", "price_wholesale", "price_distributor",
      "cost_price", "stock", "unit", "category", "brand", "sku", "gtin", "weight",
      "is_active", "is_fresh", "is_wholesale", "slug", "meta_title", "meta_description", "image_url",
    ];
    const rows = (products || []).map((p: any) => [
      p.id, p.name, p.description || "", p.price, p.original_price || "", p.price_wholesale || "",
      p.price_distributor || "", p.cost_price || "", p.stock, p.unit || "unidad",
      categoryIdMap[p.category_id] || "", p.brand || "", p.sku || "", p.gtin || "",
      p.weight || "", p.is_active !== false ? "TRUE" : "FALSE", p.is_fresh ? "TRUE" : "FALSE",
      p.is_wholesale ? "TRUE" : "FALSE", p.slug || "", p.meta_title || "", p.meta_description || "",
      p.image_url || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario_surte_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} productos exportados`);
  };

  const downloadXLS = async () => {
    // Generate a TSV that Excel can open natively
    const headers = [
      "id", "name", "description", "price", "original_price", "price_wholesale", "price_distributor",
      "cost_price", "stock", "unit", "category", "brand", "sku", "gtin", "weight",
      "is_active", "is_fresh", "is_wholesale", "slug", "meta_title", "meta_description", "image_url",
    ];
    const rows = (products || []).map((p: any) => [
      p.id, p.name, p.description || "", p.price, p.original_price || "", p.price_wholesale || "",
      p.price_distributor || "", p.cost_price || "", p.stock, p.unit || "unidad",
      categoryIdMap[p.category_id] || "", p.brand || "", p.sku || "", p.gtin || "",
      p.weight || "", p.is_active !== false ? "TRUE" : "FALSE", p.is_fresh ? "TRUE" : "FALSE",
      p.is_wholesale ? "TRUE" : "FALSE", p.slug || "", p.meta_title || "", p.meta_description || "",
      p.image_url || "",
    ]);

    const tsvContent = [headers, ...rows].map((row) => row.map((v: any) => String(v).replace(/\t/g, " ")).join("\t")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + tsvContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario_surte_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} productos exportados (Excel)`);
  };

  const downloadGMC = () => {
    const headers = [
      "id", "title", "description", "link", "image_link", "availability", "price",
      "sale_price", "brand", "condition", "product_type", "gtin", "mpn", "shipping_weight",
    ];
    const rows = (products || []).filter((p: any) => p.is_active !== false).map((p: any) => {
      const slug = p.slug || p.id;
      return [
        p.id,
        p.name,
        p.description || p.name,
        `https://surteya.com/producto/${slug}`,
        p.image_url || "",
        p.stock > 0 ? "in_stock" : "out_of_stock",
        `${p.price} COP`,
        p.original_price ? `${p.price} COP` : "",
        p.brand || "SURTÉ YA",
        "new",
        categoryIdMap[p.category_id] || "Alimentos",
        p.gtin || "",
        p.sku || "",
        p.weight || "",
      ];
    });

    const tsvContent = [headers, ...rows].map((row) => row.map((v: any) => String(v).replace(/\t/g, " ")).join("\t")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + tsvContent], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `google_merchant_surte_${new Date().toISOString().slice(0, 10)}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} productos exportados para Google Merchant Center`);
  };

  const downloadTemplate = () => {
    const headers = [
      "name", "description", "price", "original_price", "price_wholesale", "price_distributor",
      "cost_price", "stock", "unit", "category", "brand", "sku", "gtin", "weight",
      "is_active", "is_fresh", "is_wholesale", "meta_title", "meta_description", "image_url",
    ];
    const example = [
      "Salsa de Tomate 500g", "Salsa artesanal premium", "8500", "10000", "7500", "6800",
      "5000", "100", "unidad", "Salsas", "SURTÉ", "SAL-001", "7701234567890", "500g",
      "TRUE", "FALSE", "FALSE", "Salsa de Tomate 500g - SURTÉ YA", "Salsa de tomate artesanal 500g al mejor precio", "",
    ];
    const csvContent = [headers, example]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_productos_surte.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let current = "";
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === "," || ch === "\t") { row.push(current.trim()); current = ""; }
        else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++;
          row.push(current.trim());
          if (row.some((c) => c !== "")) rows.push(row);
          row = []; current = "";
        } else { current += ch; }
      }
    }
    row.push(current.trim());
    if (row.some((c) => c !== "")) rows.push(row);
    return rows;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("El archivo no contiene datos");

      const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
      const dataRows = rows.slice(1);

      let created = 0, updated = 0;
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });

        const name = obj.name || obj.nombre;
        if (!name) { errors.push(`Fila ${i + 2}: sin nombre`); continue; }

        const price = Number(obj.price || obj.precio || 0);
        if (!price) { errors.push(`Fila ${i + 2}: "${name}" sin precio válido`); continue; }

        const catName = (obj.category || obj.categoria || "").toLowerCase();
        const catId = categoryMap[catName] || null;

        const slug = (obj.slug || name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const payload: any = {
          name,
          description: obj.description || obj.descripcion || null,
          price,
          original_price: obj.original_price ? Number(obj.original_price) : null,
          price_wholesale: obj.price_wholesale ? Number(obj.price_wholesale) : null,
          price_distributor: obj.price_distributor ? Number(obj.price_distributor) : null,
          cost_price: obj.cost_price ? Number(obj.cost_price) : null,
          stock: Number(obj.stock || 0),
          unit: obj.unit || obj.unidad || "unidad",
          category_id: catId,
          brand: obj.brand || obj.marca || null,
          sku: obj.sku || null,
          gtin: obj.gtin || obj.ean || null,
          weight: obj.weight || obj.peso || null,
          is_active: (obj.is_active || "true").toLowerCase() !== "false",
          is_fresh: (obj.is_fresh || "false").toLowerCase() === "true",
          is_wholesale: (obj.is_wholesale || "false").toLowerCase() === "true",
          slug,
          meta_title: obj.meta_title || null,
          meta_description: obj.meta_description || null,
          image_url: obj.image_url || null,
        };

        // If ID provided, try update
        if (obj.id) {
          const { error } = await supabase.from("products").update(payload).eq("id", obj.id);
          if (error) { errors.push(`Fila ${i + 2}: ${error.message}`); continue; }
          updated++;
        } else {
          const { error } = await supabase.from("products").insert(payload);
          if (error) { errors.push(`Fila ${i + 2}: ${error.message}`); continue; }
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
      <p className="text-xs text-muted-foreground">Gestiona tus productos de forma masiva usando archivos CSV o Excel.</p>

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
          Sube un archivo CSV o XLS/TSV. Si incluyes la columna <code className="bg-muted px-1 py-0.5 rounded text-[10px]">id</code>, los productos existentes se actualizarán. Sin <code className="bg-muted px-1 py-0.5 rounded text-[10px]">id</code>, se crearán nuevos.
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
            <div className="space-y-1 max-h-32 overflow-y-auto">
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
          <li>Usa la <strong>plantilla</strong> como referencia para los nombres de columnas.</li>
          <li>La columna <strong>category</strong> debe coincidir con el nombre exacto de la categoría.</li>
          <li>Los campos <strong>is_active</strong>, <strong>is_fresh</strong>, <strong>is_wholesale</strong> aceptan TRUE/FALSE.</li>
          <li>Los precios deben ser numéricos sin formato (ej: 8500, no $8.500).</li>
          <li>El archivo puede ser CSV (separado por comas) o TSV (separado por tabuladores).</li>
          <li>Para actualizar productos existentes, incluye la columna <strong>id</strong> con el UUID del producto.</li>
        </ul>
      </div>
    </div>
  );
};

export default InventoryTab;
