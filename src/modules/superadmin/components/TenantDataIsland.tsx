import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download, Upload, Loader2, FileSpreadsheet, Shield, Database,
  CheckCircle2, AlertCircle, FileArchive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ISLAND_TABLES, exportTenantIsland, forceOrgOnRows, triggerDownload,
  type IslandTable,
} from "@/modules/tenant/lib/tenantDataIsland";
import {
  normalizeImportedHeaders, cleanImportedRows, buildImportMutationPlan,
} from "@/utils/dataImportUtils";
import * as XLSX from "xlsx";

interface RowStatus {
  status: "idle" | "loading" | "ok" | "error";
  detail?: string;
}

export default function TenantDataIsland() {
  const { currentOrg } = useOrganization();
  const [exporting, setExporting] = useState(false);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!currentOrg) return null;

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const { blob, filename, summary } = await exportTenantIsland(currentOrg.id, currentOrg.slug);
      triggerDownload(blob, filename);
      const total = summary.reduce((s, r) => s + r.rows, 0);
      toast.success(`Exportado ${filename} (${total} filas en ${summary.length} tablas)`);
    } catch (err: any) {
      toast.error(`Error exportando: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (t: IslandTable, file: File) => {
    if (!window.confirm(
      `Importar a "${t.label}" de la tienda "${currentOrg.name}".\n\n` +
      `Todas las filas se asignarán automáticamente a esta tienda (organization_id forzado). ` +
      `Las filas con id existente se actualizarán; las nuevas se crearán.\n\n¿Continuar?`
    )) return;

    setRowStatus((s) => ({ ...s, [t.name]: { status: "loading", detail: "Leyendo archivo…" } }));
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Archivo sin datos");
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      const normalized = normalizeImportedHeaders(raw);
      const cleaned = cleanImportedRows(normalized, t as any);
      // CRÍTICO: forzar organization_id antes de cualquier insert/upsert
      const scoped = forceOrgOnRows(cleaned, currentOrg.id, t.skipOnImport);
      const { rowsWithId, rowsWithoutId, totalRows } = buildImportMutationPlan(scoped);

      if (!totalRows) throw new Error("No se detectaron filas");

      let ok = 0, fail = 0;
      const BATCH = 50;

      const runBatch = async (rows: any[], mode: "upsert" | "insert") => {
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          setRowStatus((s) => ({
            ...s, [t.name]: { status: "loading", detail: `${mode} ${i + batch.length}/${rows.length}` },
          }));
          const op = mode === "upsert"
            ? (supabase as any).from(t.table).upsert(batch, { onConflict: "id" })
            : (supabase as any).from(t.table).insert(batch);
          const { error } = await op;
          if (error) {
            // fallback fila a fila
            for (const row of batch) {
              const single = mode === "upsert"
                ? (supabase as any).from(t.table).upsert(row, { onConflict: "id" })
                : (supabase as any).from(t.table).insert(row);
              const { error: e2 } = await single;
              if (e2) fail++; else ok++;
            }
          } else {
            ok += batch.length;
          }
        }
      };

      if (rowsWithId.length) await runBatch(rowsWithId, "upsert");
      if (rowsWithoutId.length) await runBatch(rowsWithoutId, "insert");

      const detail = `${ok} ok, ${fail} con error`;
      setRowStatus((s) => ({
        ...s, [t.name]: { status: fail === 0 ? "ok" : "error", detail },
      }));
      if (fail === 0) toast.success(`${t.label}: ${detail}`);
      else toast.warning(`${t.label}: ${detail}`);
    } catch (err: any) {
      setRowStatus((s) => ({ ...s, [t.name]: { status: "error", detail: err.message } }));
      toast.error(`${t.label}: ${err.message}`);
    } finally {
      const input = fileInputs.current[t.name];
      if (input) input.value = "";
    }
  };

  const handleExportOne = async (t: IslandTable) => {
    setRowStatus((s) => ({ ...s, [t.name]: { status: "loading", detail: "Exportando…" } }));
    try {
      const { fetchIslandRows } = await import("@/modules/tenant/lib/tenantDataIsland");
      const { jsonToCsv, downloadCsv } = await import("@/utils/csvUtils");
      const rows = await fetchIslandRows(t, currentOrg.id);
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(jsonToCsv(rows), `${currentOrg.slug}-${t.name}-${date}.csv`);
      setRowStatus((s) => ({ ...s, [t.name]: { status: "ok", detail: `${rows.length} filas` } }));
    } catch (err: any) {
      setRowStatus((s) => ({ ...s, [t.name]: { status: "error", detail: err.message } }));
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con scope visible */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Database size={18} className="text-primary" />
              <h2 className="font-heading font-bold text-lg">Datos de la tienda</h2>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Shield size={10} /> Aislamiento estricto
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Export/import de catálogos y configuración <strong>solo</strong> para{" "}
              <span className="text-foreground font-medium">{currentOrg.name}</span>{" "}
              (<code className="text-[10px]">{currentOrg.slug}</code>).
              Toda fila importada se asigna automáticamente a esta tienda.
            </p>
          </div>
          <Button onClick={handleExportAll} disabled={exporting} className="btn-surte gap-1.5 text-xs">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileArchive size={14} />}
            Exportar todo (ZIP)
          </Button>
        </div>
      </div>

      {/* Lista de tablas */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {ISLAND_TABLES.map((t) => {
          const status = rowStatus[t.name];
          return (
            <div key={t.name} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <FileSpreadsheet size={16} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Tabla <code>{t.table}</code>
                  {status?.detail && (
                    <>
                      {" · "}
                      <span className={
                        status.status === "ok" ? "text-success" :
                        status.status === "error" ? "text-destructive" : ""
                      }>{status.detail}</span>
                    </>
                  )}
                </p>
              </div>
              {status?.status === "loading" && <Loader2 size={14} className="animate-spin text-primary" />}
              {status?.status === "ok" && <CheckCircle2 size={14} className="text-success" />}
              {status?.status === "error" && <AlertCircle size={14} className="text-destructive" />}

              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => handleExportOne(t)} disabled={status?.status === "loading"}>
                <Download size={12} /> CSV
              </Button>

              <input
                ref={(el) => (fileInputs.current[t.name] = el)}
                type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(t, f);
                }}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => fileInputs.current[t.name]?.click()}
                      disabled={status?.status === "loading"}>
                <Upload size={12} /> Importar
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground px-1">
        <Shield size={11} className="inline mr-1" />
        Cualquier <code>organization_id</code> que venga en el archivo importado se ignora y se reemplaza
        por el de la tienda activa. Esto previene contaminación cruzada entre tiendas.
      </p>
    </div>
  );
}
