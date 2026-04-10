import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Database, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EXPORTABLE_TABLES,
  jsonToCsv,
  downloadCsv,
  parseCsv,
  readFileAsText,
  type TableDef,
} from "@/utils/csvUtils";
import * as XLSX from "xlsx";

type Status = "idle" | "loading" | "success" | "error";

interface TableStatus {
  status: Status;
  count?: number;
  error?: string;
}

const DataManagementTab = () => {
  const [exportStatus, setExportStatus] = useState<Record<string, TableStatus>>({});
  const [importStatus, setImportStatus] = useState<Record<string, TableStatus>>({});
  const [bulkExporting, setBulkExporting] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Single table export ──────────────────────────────────
  const handleExport = async (def: TableDef) => {
    setExportStatus((s) => ({ ...s, [def.name]: { status: "loading" } }));
    try {
      let query = supabase.from(def.table as any).select("*");
      if (def.orderBy) query = query.order(def.orderBy.column, { ascending: def.orderBy.ascending });

      // Handle pagination for large tables (>1000 rows)
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (!allData.length) {
        toast.info(`${def.label}: sin datos para exportar`);
        setExportStatus((s) => ({ ...s, [def.name]: { status: "success", count: 0 } }));
        return;
      }

      const csv = jsonToCsv(allData);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadCsv(csv, `surteya_${def.name}_${timestamp}.csv`);
      setExportStatus((s) => ({ ...s, [def.name]: { status: "success", count: allData.length } }));
      toast.success(`${def.label}: ${allData.length} registros exportados`);
    } catch (err: any) {
      setExportStatus((s) => ({ ...s, [def.name]: { status: "error", error: err.message } }));
      toast.error(`Error exportando ${def.label}: ${err.message}`);
    }
  };

  // ── Bulk export all tables ──────────────────────────────
  const handleBulkExport = async () => {
    setBulkExporting(true);
    for (const def of EXPORTABLE_TABLES) {
      await handleExport(def);
    }
    setBulkExporting(false);
    toast.success("Exportación masiva completada");
  };

  // ── Single table import ──────────────────────────────────
  const handleImport = async (def: TableDef, file: File) => {
    setImportStatus((s) => ({ ...s, [def.name]: { status: "loading" } }));
    try {
      const text = await readFileAsText(file);
      let rows = parseCsv(text);

      if (!rows.length) {
        throw new Error("El archivo CSV está vacío o no tiene formato válido");
      }

      // Clean rows: remove skip columns, parse JSON arrays, handle empty strings
      rows = rows.map((row) => {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (def.skipOnImport?.includes(key)) continue;
          if (value === "") {
            cleaned[key] = null;
          } else if (value.startsWith("[") || value.startsWith("{")) {
            try {
              cleaned[key] = JSON.parse(value);
            } catch {
              cleaned[key] = value;
            }
          } else if (value === "true") {
            cleaned[key] = true;
          } else if (value === "false") {
            cleaned[key] = false;
          } else if (!isNaN(Number(value)) && value.trim() !== "" && !key.includes("phone") && !key.includes("gtin") && !key.includes("sku") && key !== "code") {
            cleaned[key] = Number(value);
          } else {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });

      // Upsert in batches of 100
      const batchSize = 100;
      let imported = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from(def.table as any).upsert(batch as any, { onConflict: "id" });
        if (error) throw error;
        imported += batch.length;
      }

      setImportStatus((s) => ({ ...s, [def.name]: { status: "success", count: imported } }));
      toast.success(`${def.label}: ${imported} registros importados`);
    } catch (err: any) {
      setImportStatus((s) => ({ ...s, [def.name]: { status: "error", error: err.message } }));
      toast.error(`Error importando ${def.label}: ${err.message}`);
    }
  };

  const StatusIcon = ({ status }: { status: Status }) => {
    switch (status) {
      case "loading": return <Loader2 size={14} className="animate-spin text-primary" />;
      case "success": return <CheckCircle2 size={14} className="text-secondary" />;
      case "error": return <AlertCircle size={14} className="text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <Database size={22} />
            Gestión de Datos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Exporta e importa todos los datos de la plataforma en formato CSV
          </p>
        </div>
        <Button onClick={handleBulkExport} disabled={bulkExporting} className="btn-surte gap-2">
          {bulkExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Exportar Todo
        </Button>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {EXPORTABLE_TABLES.map((def) => {
          const exp = exportStatus[def.name];
          const imp = importStatus[def.name];
          return (
            <Card key={def.name} className="border border-border">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-heading font-semibold flex items-center gap-2">
                    <FileSpreadsheet size={15} className="text-primary" />
                    {def.label}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {def.table}
                  </Badge>
                </div>
                {(exp || imp) && (
                  <CardDescription className="text-xs mt-1 flex items-center gap-1.5">
                    {exp && (
                      <span className="flex items-center gap-1">
                        <StatusIcon status={exp.status} />
                        {exp.status === "success" && `${exp.count ?? 0} exportados`}
                        {exp.status === "error" && <span className="text-destructive truncate max-w-[150px]">{exp.error}</span>}
                      </span>
                    )}
                    {imp && (
                      <span className="flex items-center gap-1 ml-2">
                        <StatusIcon status={imp.status} />
                        {imp.status === "success" && `${imp.count ?? 0} importados`}
                        {imp.status === "error" && <span className="text-destructive truncate max-w-[150px]">{imp.error}</span>}
                      </span>
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={exp?.status === "loading"}
                  onClick={() => handleExport(def)}
                >
                  {exp?.status === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Exportar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={imp?.status === "loading"}
                  onClick={() => fileInputRefs.current[def.name]?.click()}
                >
                  {imp?.status === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Importar
                </Button>
                <input
                  ref={(el) => { fileInputRefs.current[def.name] = el; }}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!window.confirm(`¿Importar datos a "${def.label}"?\n\nEsto hará un UPSERT (actualiza si existe, inserta si no). Los registros existentes con el mismo ID serán sobrescritos.`)) {
                      e.target.value = "";
                      return;
                    }
                    await handleImport(def, file);
                    e.target.value = "";
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Instructions */}
      <Card className="border border-border bg-muted/30">
        <CardContent className="py-4 px-5 space-y-2 text-sm text-muted-foreground">
          <p className="font-heading font-semibold text-foreground">📋 Instrucciones</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Exportar</strong>: Descarga un CSV con todos los registros de la tabla seleccionada.</li>
            <li><strong>Importar</strong>: Sube un CSV con la misma estructura. Se usa UPSERT por ID (actualiza existentes, inserta nuevos).</li>
            <li><strong>Exportar Todo</strong>: Descarga CSVs de todas las tablas de forma secuencial.</li>
            <li>Los archivos incluyen BOM para compatibilidad con Excel y caracteres especiales (ñ, tildes).</li>
            <li>Columnas auto-generadas (created_at, updated_at) se omiten al importar.</li>
            <li>Para migrar datos a producción: exporta aquí, luego importa en el entorno Live.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataManagementTab;
