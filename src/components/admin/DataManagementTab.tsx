import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  Database, FileDown, RotateCcw, RefreshCw, Info, Shield, Clock, Trash2,
  ChevronDown, ChevronUp, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  EXPORTABLE_TABLES,
  jsonToCsv,
  downloadCsv,
  readFileAsText,
  type TableDef,
} from "@/utils/csvUtils";
import {
  analyzeImportRows,
  buildImportMutationPlan,
  cleanImportedRows,
  normalizeImportedHeaders,
  type ImportPreviewAnalysis,
} from "@/utils/dataImportUtils";
import * as XLSX from "xlsx";

type Status = "idle" | "loading" | "success" | "error";

interface TableStatus {
  status: Status;
  count?: number;
  error?: string;
  timestamp?: string;
}

interface BackupEntry {
  id: string;
  tableName: string;
  tableLabel: string;
  data: any[];
  timestamp: string;
  rowCount: number;
}

interface ImportPreview {
  def: TableDef;
  file: File;
  rows: Record<string, any>[];
  columns: string[];
  analysis: ImportPreviewAnalysis;
}

interface ImportProgressState {
  current: number;
  total: number;
  table: string;
  phase: string;
  detail: string;
}

interface RowError {
  row: number;
  message: string;
  data: Record<string, unknown>;
}

interface ImportReport {
  table: string;
  total: number;
  success: number;
  failed: number;
  errors: RowError[];
}

const DataManagementTab = () => {
  const [exportStatus, setExportStatus] = useState<Record<string, TableStatus>>({});
  const [importStatus, setImportStatus] = useState<Record<string, TableStatus>>({});
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [syncChecking, setSyncChecking] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, number | null>>({});
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Fetch all rows (paginated) ─────────────────────────
  const fetchAllRows = async (def: TableDef): Promise<any[]> => {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from(def.table as any).select("*");
      if (def.orderBy) query = query.order(def.orderBy.column, { ascending: def.orderBy.ascending });
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
    return allData;
  };

  // ── Download as XLSX ───────────────────────────────────
  const downloadXlsx = (rows: Record<string, any>[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename);
  };

  // ── Check sync status for all tables ───────────────────
  const handleCheckSync = async () => {
    setSyncChecking(true);
    const results: Record<string, number | null> = {};
    for (const def of EXPORTABLE_TABLES) {
      try {
        const { count, error } = await supabase.from(def.table as any).select("*", { count: "exact", head: true });
        if (error) throw error;
        results[def.name] = count ?? 0;
      } catch {
        results[def.name] = null;
      }
    }
    setSyncResults(results);
    setSyncChecking(false);
    toast.success("Estado de sincronización actualizado");
  };

  // ── Create backup before import ────────────────────────
  const createBackup = async (def: TableDef): Promise<BackupEntry> => {
    const data = await fetchAllRows(def);
    const entry: BackupEntry = {
      id: `${def.name}_${Date.now()}`,
      tableName: def.name,
      tableLabel: def.label,
      data,
      timestamp: new Date().toLocaleString("es-CO"),
      rowCount: data.length,
    };
    setBackups((prev) => [entry, ...prev].slice(0, 20));
    return entry;
  };

  // ── Restore from backup ────────────────────────────────
  const handleRestore = async (backup: BackupEntry) => {
    const def = EXPORTABLE_TABLES.find((t) => t.name === backup.tableName);
    if (!def) return;
    if (!window.confirm(`¿Restaurar "${backup.tableLabel}" al estado del ${backup.timestamp}?\n\nSe sobrescribirán ${backup.rowCount} registros.`)) return;

    setImportStatus((s) => ({ ...s, [def.name]: { status: "loading" } }));
    try {
      const batchSize = 100;
      for (let i = 0; i < backup.data.length; i += batchSize) {
        const batch = backup.data.slice(i, i + batchSize);
        const { error } = await supabase.from(def.table as any).upsert(batch as any, { onConflict: "id" });
        if (error) throw error;
      }
      setImportStatus((s) => ({
        ...s,
        [def.name]: { status: "success", count: backup.rowCount, timestamp: new Date().toLocaleString("es-CO") },
      }));
      toast.success(`${def.label}: restaurado desde backup (${backup.rowCount} registros)`);
    } catch (err: any) {
      setImportStatus((s) => ({ ...s, [def.name]: { status: "error", error: err.message } }));
      toast.error(`Error restaurando ${def.label}: ${err.message}`);
    }
  };

  // ── Single table export ────────────────────────────────
  const handleExport = async (def: TableDef, format: "csv" | "xlsx" = "csv") => {
    setExportStatus((s) => ({ ...s, [def.name]: { status: "loading" } }));
    try {
      const allData = await fetchAllRows(def);
      if (!allData.length) {
        toast.info(`${def.label}: sin datos para exportar`);
        setExportStatus((s) => ({ ...s, [def.name]: { status: "success", count: 0, timestamp: new Date().toLocaleString("es-CO") } }));
        return;
      }
      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === "xlsx") {
        downloadXlsx(allData, `surteya_${def.name}_${timestamp}.xlsx`);
      } else {
        downloadCsv(jsonToCsv(allData), `surteya_${def.name}_${timestamp}.csv`);
      }
      setExportStatus((s) => ({
        ...s,
        [def.name]: { status: "success", count: allData.length, timestamp: new Date().toLocaleString("es-CO") },
      }));
      toast.success(`${def.label}: ${allData.length} registros exportados (${format.toUpperCase()})`);
    } catch (err: any) {
      setExportStatus((s) => ({ ...s, [def.name]: { status: "error", error: err.message } }));
      toast.error(`Error exportando ${def.label}: ${err.message}`);
    }
  };

  // ── Bulk export ────────────────────────────────────────
  const handleBulkExport = async (format: "csv" | "xlsx" = "csv") => {
    setBulkExporting(true);
    setBulkProgress(0);
    for (let i = 0; i < EXPORTABLE_TABLES.length; i++) {
      await handleExport(EXPORTABLE_TABLES[i], format);
      setBulkProgress(Math.round(((i + 1) / EXPORTABLE_TABLES.length) * 100));
    }
    setBulkExporting(false);
    setBulkProgress(0);
    toast.success(`Exportación masiva completada (${format.toUpperCase()})`);
  };

  // ── Parse file for preview ─────────────────────────────
  const parseFile = async (file: File): Promise<Record<string, any>[]> => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("El archivo no contiene hojas de datos");
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
      return normalizeImportedHeaders(rows);
    } catch (err: any) {
      console.error("Error parsing file:", err);
      throw new Error(`No se pudo leer el archivo: ${err.message}`);
    }
  };

  // ── Handle file selection → show preview ───────────────
  const handleFileSelected = useCallback(async (def: TableDef, file: File) => {
    try {
      setImportProgress({
        current: 0,
        total: 1,
        table: def.label,
        phase: "Analizando archivo",
        detail: `Leyendo ${file.name} para validar columnas y filas antes de cargar.`,
      });
      const rows = await parseFile(file);
      if (!rows.length) {
        setImportProgress(null);
        toast.error("El archivo está vacío o no tiene formato válido");
        return;
      }
      const columns = Object.keys(rows[0]);
      setImportPreview({ def, file, rows, columns, analysis: analyzeImportRows(rows) });
      setImportProgress(null);
    } catch (err: any) {
      setImportProgress(null);
      toast.error(`Error leyendo archivo: ${err.message}`);
    }
  }, []);

  // ── Execute import with backup & progress ──────────────
  const executeImport = async () => {
    if (!importPreview) return;
    const { def, rows: rawRows } = importPreview;
    setImportPreview(null);
    setImportStatus((s) => ({ ...s, [def.name]: { status: "loading" } }));

    try {
      // Create backup first
      setImportProgress({
        current: 0,
        total: rawRows.length || 1,
        table: def.label,
        phase: "Creando punto de reversión",
        detail: `Respaldando el estado actual de ${def.label} antes de modificar datos.`,
      });
      toast.info(`Creando backup de "${def.label}" antes de importar...`);
      await createBackup(def);

      // Clean rows
      const rows = cleanImportedRows(rawRows, def);
      const { rowsWithId, rowsWithoutId, totalRows } = buildImportMutationPlan(rows);

      if (!totalRows) {
        throw new Error("No se detectaron filas válidas para importar.");
      }

      const batchSize = 100;
      let imported = 0;
      let updated = 0;
      let created = 0;

      if (rowsWithId.length > 0) {
        setImportProgress({
          current: 0,
          total: totalRows,
          table: def.label,
          phase: "Actualizando registros existentes",
          detail: `${rowsWithId.length} filas con ID se subirán como actualización o inserción controlada.`,
        });

        for (let i = 0; i < rowsWithId.length; i += batchSize) {
          const batch = rowsWithId.slice(i, i + batchSize);
          const { error } = await supabase.from(def.table as any).upsert(batch as any, { onConflict: "id" });
          if (error) throw error;
          imported += batch.length;
          updated += batch.length;
          setImportProgress({
            current: imported,
            total: totalRows,
            table: def.label,
            phase: "Actualizando registros existentes",
            detail: `Subiendo lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(rowsWithId.length / batchSize)} con filas identificadas por ID.`,
          });
        }
      }

      if (rowsWithoutId.length > 0) {
        setImportProgress({
          current: imported,
          total: totalRows,
          table: def.label,
          phase: "Creando registros nuevos",
          detail: `${rowsWithoutId.length} filas sin ID se crearán como nuevos registros.`,
        });

        for (let i = 0; i < rowsWithoutId.length; i += batchSize) {
          const batch = rowsWithoutId.slice(i, i + batchSize);
          const { error } = await supabase.from(def.table as any).insert(batch as any);
          if (error) throw error;
          imported += batch.length;
          created += batch.length;
          setImportProgress({
            current: imported,
            total: totalRows,
            table: def.label,
            phase: "Creando registros nuevos",
            detail: `Subiendo lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(rowsWithoutId.length / batchSize)} con filas nuevas.`,
          });
        }
      }

      setImportProgress(null);
      setImportStatus((s) => ({
        ...s,
        [def.name]: { status: "success", count: imported, timestamp: new Date().toLocaleString("es-CO") },
      }));
      toast.success(`${def.label}: ${imported} registros procesados (${updated} actualizados, ${created} nuevos)`);
    } catch (err: any) {
      setImportProgress(null);
      setImportStatus((s) => ({ ...s, [def.name]: { status: "error", error: err.message } }));
      toast.error(`Error importando ${def.label}: ${err.message}`);
    }
  };

  const StatusBadge = ({ tableStatus, type }: { tableStatus?: TableStatus; type: "export" | "import" }) => {
    if (!tableStatus || tableStatus.status === "idle") return null;
    const label = type === "export" ? "exportados" : "importados";
    return (
      <div className="flex items-center gap-1.5 text-xs mt-1">
        {tableStatus.status === "loading" && <Loader2 size={12} className="animate-spin text-primary" />}
        {tableStatus.status === "success" && (
          <span className="flex items-center gap-1 text-secondary">
            <CheckCircle2 size={12} /> {tableStatus.count ?? 0} {label}
          </span>
        )}
        {tableStatus.status === "error" && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertCircle size={12} />
            <span className="truncate max-w-[180px]">{tableStatus.error}</span>
          </span>
        )}
        {tableStatus.timestamp && (
          <span className="text-muted-foreground text-[10px] ml-1">
            <Clock size={10} className="inline mr-0.5" />
            {tableStatus.timestamp}
          </span>
        )}
      </div>
    );
  };

  const totalTables = EXPORTABLE_TABLES.length;
  const syncedCount = Object.values(syncResults).filter((v) => v !== null && v > 0).length;
  const emptyCount = Object.values(syncResults).filter((v) => v === 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-heading font-bold flex items-center gap-2">
            <Database size={20} />
            Gestión de Datos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exporta, importa y sincroniza datos entre entornos con backups automáticos
          </p>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={bulkExporting} className="btn-surte gap-1.5 text-xs">
                {bulkExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Exportar Todo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkExport("csv")}>
                <FileSpreadsheet size={14} className="mr-2" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkExport("xlsx")}>
                <FileDown size={14} className="mr-2" /> Excel (XLSX)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleCheckSync} disabled={syncChecking}>
            {syncChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Verificar Estado
          </Button>

          {backups.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowBackups(true)}>
              <RotateCcw size={14} />
              Backups ({backups.length})
            </Button>
          )}

          <Button size="sm" variant="ghost" className="gap-1.5 text-xs ml-auto" onClick={() => setShowInstructions(!showInstructions)}>
            <Info size={14} />
            {showInstructions ? "Ocultar ayuda" : "Ayuda"}
          </Button>
        </div>
      </div>

      {/* Bulk progress */}
      {bulkExporting && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium">Exportando todas las tablas...</span>
              <span className="text-muted-foreground">{bulkProgress}%</span>
            </div>
            <Progress value={bulkProgress} className="h-1.5" />
          </CardContent>
        </Card>
      )}

      {/* Import progress */}
      {importProgress && (
        <Card className="border-secondary/30 bg-secondary/5 animate-pulse">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium">{importProgress.phase}: {importProgress.table}</span>
              <span className="text-muted-foreground">{importProgress.current}/{importProgress.total}</span>
            </div>
            <Progress value={(importProgress.current / importProgress.total) * 100} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground mt-2">{importProgress.detail}</p>
          </CardContent>
        </Card>
      )}

      {/* Sync summary */}
      {Object.keys(syncResults).length > 0 && (
        <Card className="border border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-heading font-semibold flex items-center gap-1.5">
                <BarChart3 size={14} /> Estado del Entorno
              </span>
              <Badge variant="default" className="text-[10px]">{syncedCount} con datos</Badge>
              {emptyCount > 0 && <Badge variant="destructive" className="text-[10px]">{emptyCount} vacías</Badge>}
              <Badge variant="outline" className="text-[10px]">{totalTables} tablas total</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions (collapsible) */}
      {showInstructions && (
        <Card className="border border-border bg-muted/30">
          <CardContent className="py-3 px-4 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-heading font-semibold text-foreground text-sm">📋 Instrucciones</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>Exportar</strong>: Descarga CSV o Excel con todos los registros.</li>
              <li><strong>Importar</strong>: Sube CSV o XLSX. Se crea backup automático antes de importar.</li>
              <li><strong>Verificar Estado</strong>: Muestra cuántos registros tiene cada tabla.</li>
              <li><strong>Backups</strong>: Cada importación crea un punto de reversión. Restaura con un clic.</li>
              <li><strong>Vista previa</strong>: Antes de importar, verás un resumen de los datos del archivo.</li>
              <li>Para poblar producción: exporta aquí → publica → importa en Live.</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Table grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {EXPORTABLE_TABLES.map((def) => {
          const exp = exportStatus[def.name];
          const imp = importStatus[def.name];
          const syncCount = syncResults[def.name];
          const hasData = syncCount !== undefined && syncCount !== null && syncCount > 0;
          const isEmpty = syncCount === 0;

          return (
            <Card key={def.name} className={`border transition-colors ${isEmpty ? "border-destructive/30 bg-destructive/5" : hasData ? "border-secondary/30" : "border-border"}`}>
              <CardHeader className="py-2.5 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-heading font-semibold flex items-center gap-1.5">
                    <FileSpreadsheet size={13} className="text-primary shrink-0" />
                    {def.label}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {syncCount !== undefined && syncCount !== null && (
                      <Badge variant={hasData ? "default" : "destructive"} className="text-[9px] px-1.5 py-0">
                        {syncCount}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                      {def.table}
                    </Badge>
                  </div>
                </div>
                <StatusBadge tableStatus={exp} type="export" />
                <StatusBadge tableStatus={imp} type="import" />
                {syncCount !== undefined && (
                  <p className={`text-[10px] mt-1 ${isEmpty ? "text-destructive" : hasData ? "text-secondary" : "text-muted-foreground"}`}>
                    {isEmpty ? "Sin sincronizar en este entorno" : hasData ? "Con datos listos para actualizar" : "Estado pendiente de validar"}
                  </p>
                )}
              </CardHeader>
              <CardContent className="px-3 pb-2.5 pt-0 flex gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-[11px] h-7" disabled={exp?.status === "loading"}>
                      {exp?.status === "loading" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExport(def, "csv")}>CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport(def, "xlsx")}>Excel (XLSX)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-[11px] h-7"
                  disabled={imp?.status === "loading"}
                  onClick={() => fileInputRefs.current[def.name]?.click()}
                >
                  {imp?.status === "loading" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Importar
                </Button>
                <input
                  ref={(el) => { fileInputRefs.current[def.name] = el; }}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const name = file.name.toLowerCase();
                    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
                      toast.error("Formato no soportado. Usa archivos .csv, .xlsx o .xls");
                      e.target.value = "";
                      return;
                    }
                    await handleFileSelected(def, file);
                    e.target.value = "";
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={(open) => !open && setImportPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              Importar a "{importPreview?.def.label}"
            </DialogTitle>
            <DialogDescription>
              Se creará un backup automático antes de importar para que puedas revertir si algo sale mal.
            </DialogDescription>
          </DialogHeader>

          {importPreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Archivo</p>
                  <p className="font-medium truncate">{importPreview.file.name}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Registros</p>
                  <p className="font-medium">{importPreview.rows.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-muted-foreground">Filas con ID</p>
                  <p className="font-semibold">{importPreview.analysis.rowsWithId}</p>
                  <p className="text-muted-foreground mt-1">Se actualizarán si ya existen.</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-muted-foreground">Filas nuevas</p>
                  <p className="font-semibold">{importPreview.analysis.rowsWithoutId}</p>
                  <p className="text-muted-foreground mt-1">Se crearán como registros nuevos.</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-muted-foreground">IDs vacíos</p>
                  <p className="font-semibold">{importPreview.analysis.blankIdRows}</p>
                  <p className="text-muted-foreground mt-1">Se tratarán como registros nuevos.</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-1.5">Columnas detectadas ({importPreview.columns.length}):</p>
                <div className="flex flex-wrap gap-1">
                  {importPreview.columns.map((col) => (
                    <Badge key={col} variant={importPreview.def.skipOnImport?.includes(col) ? "secondary" : "outline"} className="text-[10px]">
                      {col}
                      {importPreview.def.skipOnImport?.includes(col) && " (omitida)"}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs">
                <p className="font-medium text-accent-foreground flex items-center gap-1.5 mb-1">
                  <AlertCircle size={14} /> Operación UPSERT
                </p>
                <p className="text-muted-foreground">
                  Las filas con ID actualizarán registros existentes; las filas sin ID crearán registros nuevos. Se creará backup automático antes de cargar.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancelar</Button>
            <Button onClick={executeImport} className="btn-surte gap-1.5">
              <Upload size={14} /> Importar con Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backups Dialog */}
      <Dialog open={showBackups} onOpenChange={setShowBackups}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw size={18} className="text-primary" />
              Puntos de Reversión
            </DialogTitle>
            <DialogDescription>
              Cada importación crea un backup automático. Restaura cualquier tabla a su estado previo.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {backups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay backups disponibles aún.</p>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <Card key={backup.id} className="border border-border">
                    <CardContent className="py-2.5 px-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{backup.tableLabel}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock size={11} /> {backup.timestamp} · {backup.rowCount} registros
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => handleRestore(backup)}>
                        <RotateCcw size={12} /> Restaurar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataManagementTab;
