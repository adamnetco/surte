/**
 * POS-einvoice-bulk-retry-admin · AC6 — UI Superadmin
 * Permite seleccionar N organizaciones (máx 20), parametrizar batch_size y
 * max_retries, ejecutar un preview (dry_run) y luego confirmar el reenvío.
 *
 * Llama al edge function `einvoice-resend-bulk-admin` (verify_jwt=true; gated por
 * has_role(superadmin)). Cualquier intento desde un rol no autorizado recibe 403.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RefreshCw, Search, Send } from "lucide-react";

const MAX_ORGS_PER_REQUEST = 20;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_WALLCLOCK_MS = 45_000;


interface Org {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

interface BatchResult {
  index: number;
  candidates: number;
  requeued: number;
  status: "success" | "error";
  error?: string;
}

interface PerOrgResult {
  organization_id: string;
  candidates: number;
  requeued: number;
  status: "success" | "error" | "skipped";
  error?: string;
  // POS-optimizar-bulk-retry-timeouts
  batches?: BatchResult[];
  partial?: boolean;
  truncated?: boolean;
  last_processed_id?: string | null;
}

interface NextCursor {
  organization_id: string;
  last_processed_id: string | null;
}

interface BulkResponse {
  success: boolean;
  dry_run: boolean;
  total_orgs: number;
  total_requeued: number;
  partial?: boolean;
  results: PerOrgResult[];
  truncated?: boolean;
  next_cursor?: NextCursor;
  elapsed_ms?: number;
}

export default function EinvoiceBulkRetry() {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dryRun, setDryRun] = useState(true);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [maxRetries, setMaxRetries] = useState(DEFAULT_MAX_RETRIES);
  const [wallclockMs, setWallclockMs] = useState(DEFAULT_WALLCLOCK_MS);
  const [running, setRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState<BulkResponse | null>(null);

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["bulk-retry-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, slug, name, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Org[];
    },
  });

  const filteredOrgs = useMemo(() => {
    if (!orgs) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return orgs;
    return orgs.filter((o) =>
      o.name.toLowerCase().includes(f) || o.slug.toLowerCase().includes(f),
    );
  }, [orgs, filter]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );

  const toggle = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const selectAllVisible = () => {
    const next: Record<string, boolean> = { ...selected };
    filteredOrgs.slice(0, MAX_ORGS_PER_REQUEST).forEach((o) => { next[o.id] = true; });
    setSelected(next);
  };

  const clearSelection = () => setSelected({});

  const run = async (asDryRun: boolean, cursor?: NextCursor) => {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos una organización.");
      return;
    }
    if (selectedIds.length > MAX_ORGS_PER_REQUEST) {
      toast.error(`Máximo ${MAX_ORGS_PER_REQUEST} organizaciones por ejecución.`);
      return;
    }
    if (!asDryRun && !cursor) {
      const ok = window.confirm(
        `Reencolar facturas pendientes en ${selectedIds.length} organización(es)?\n\n` +
        `batch_size=${batchSize} · max_retries=${maxRetries} · wallclock=${Math.round(wallclockMs / 1000)}s\n` +
        `Esta acción afecta múltiples tenants. Procede solo si el dry-run fue revisado.`,
      );
      if (!ok) return;
    }

    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "einvoice-resend-bulk-admin",
        {
          body: {
            organization_ids: selectedIds,
            dry_run: asDryRun,
            batch_size: batchSize,
            max_retries: maxRetries,
            wallclock_ms: wallclockMs,
            ...(cursor ? { cursor } : {}),
          },
        },
      );
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 403) {
          toast.error("Acceso denegado: se requiere rol superadmin global.");
        } else {
          toast.error(error.message ?? "Falló la ejecución");
        }
        setLastResponse(null);
        return;
      }
      const resp = data as BulkResponse;
      setLastResponse(resp);
      if (asDryRun) {
        toast.success(`Preview: ${resp.total_requeued === 0 ? resp.results.reduce((s, r) => s + r.candidates, 0) : resp.total_requeued} candidatas en ${resp.total_orgs} org(s).`);
      } else if (resp.truncated) {
        toast.warning(
          `Truncado por wallclock: ${resp.total_requeued} reencoladas. Usa "Reanudar" para continuar.`,
        );
      } else {
        toast.success(`Reencoladas ${resp.total_requeued} facturas en ${resp.total_orgs} org(s).`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error inesperado");
    } finally {
      setRunning(false);
    }
  };

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    (orgs ?? []).forEach((o) => { m[o.id] = o.name; });
    return m;
  }, [orgs]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold">Bulk retry · Facturación DIAN</h1>
          <Badge variant="outline" className="ml-2">Superadmin</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Reenvía facturas <code>rejected/error/dead_letter/queued/pending/retrying</code> creadas hoy, agrupadas
          por organización. Usa <strong>Dry-run</strong> primero para revisar el alcance.
        </p>
      </header>

      <Card className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="batch_size">Batch size</Label>
            <Input
              id="batch_size"
              type="number"
              min={1}
              max={500}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Math.min(500, Number(e.target.value) || DEFAULT_BATCH_SIZE)))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Tamaño por lote para el worker (futura optimización · spec <code>POS-optimizar-bulk-retry-timeouts</code>).
            </p>
          </div>
          <div>
            <Label htmlFor="max_retries">Reintentos máximos</Label>
            <Input
              id="max_retries"
              type="number"
              min={0}
              max={10}
              value={maxRetries}
              onChange={(e) => setMaxRetries(Math.max(0, Math.min(10, Number(e.target.value) || DEFAULT_MAX_RETRIES)))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Reintentos del outbox antes de marcar <code>dead_letter</code>.
            </p>
          </div>
          <div>
            <Label htmlFor="wallclock_ms">Wallclock (seg)</Label>
            <Input
              id="wallclock_ms"
              type="number"
              min={5}
              max={55}
              value={Math.round(wallclockMs / 1000)}
              onChange={(e) =>
                setWallclockMs(Math.max(5, Math.min(55, Number(e.target.value) || 45)) * 1000)
              }
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Presupuesto antes de truncar (AC4). Si se corta, podrás <strong>Reanudar</strong>.
            </p>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 w-full">
              <Switch id="dry_run" checked={dryRun} onCheckedChange={setDryRun} />
              <Label htmlFor="dry_run" className="cursor-pointer">
                Dry-run (solo contar, no reencolar)
              </Label>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Buscar por nombre o slug…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {selectedIds.length} / {MAX_ORGS_PER_REQUEST} seleccionadas
            </span>
            <Button variant="ghost" size="sm" onClick={selectAllVisible}>Seleccionar visibles</Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>Limpiar</Button>
          </div>
        </div>

        {selectedIds.length > MAX_ORGS_PER_REQUEST && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Excede el máximo permitido por ejecución ({MAX_ORGS_PER_REQUEST}). Reduce la selección.
          </div>
        )}

        <div
          role="list"
          aria-label="Organizaciones disponibles"
          className="divide-y rounded-md border max-h-[420px] overflow-y-auto"
        >
          {orgsLoading && (
            <div className="p-6 text-sm text-muted-foreground flex items-center gap-2" aria-busy="true">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando organizaciones…
            </div>
          )}
          {!orgsLoading && filteredOrgs.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">Sin organizaciones activas para mostrar.</div>
          )}
          {filteredOrgs.map((o) => {
            const isChecked = !!selected[o.id];
            return (
              <label
                key={o.id}
                role="listitem"
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggle(o.id)}
                  aria-label={`Seleccionar ${o.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{o.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">/{o.slug}</p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => run(true)}
            disabled={running || selectedIds.length === 0}
          >
            {running && dryRun ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Dry-run (preview)
          </Button>
          <Button
            onClick={() => run(false)}
            disabled={running || selectedIds.length === 0 || dryRun}
            title={dryRun ? "Desactiva Dry-run para ejecutar" : undefined}
          >
            {running && !dryRun ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Reencolar ahora
          </Button>
          <p className="text-[11px] text-muted-foreground ml-auto">
            La ejecución queda registrada en <code>sync_logs · einvoice_bulk_retry_admin</code>.
          </p>
        </div>
      </Card>

      {lastResponse && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              {lastResponse.dry_run ? "Preview" : "Resultado"} · {lastResponse.total_orgs} org(s)
            </h2>
            <Badge variant={lastResponse.dry_run ? "secondary" : "default"}>
              {lastResponse.dry_run ? "dry_run" : "ejecutado"}
            </Badge>
          </div>
          {lastResponse.partial && !lastResponse.dry_run && !lastResponse.truncated && (
            <p className="text-xs text-amber-600">
              ⚠ Ejecución parcial: algunos lotes fallaron — revisa <code>sync_logs</code> con <code>phase=batch_N</code>.
            </p>
          )}
          {lastResponse.truncated && !lastResponse.dry_run && lastResponse.next_cursor && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="flex-1">
                Truncado por wallclock ({Math.round((lastResponse.elapsed_ms ?? 0) / 100) / 10}s).
                Reanuda desde org <code className="font-mono">{(nameById[lastResponse.next_cursor.organization_id] ?? lastResponse.next_cursor.organization_id).slice(0, 24)}</code>
                {lastResponse.next_cursor.last_processed_id
                  ? <> · último id <code className="font-mono">{lastResponse.next_cursor.last_processed_id.slice(0, 12)}…</code></>
                  : null}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={running}
                onClick={() => run(false, lastResponse.next_cursor!)}
              >
                {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Reanudar
              </Button>
            </div>
          )}
          <div className="divide-y rounded-md border">
            {lastResponse.results.map((r) => (
              <div key={r.organization_id} className="px-3 py-2 text-sm flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{nameById[r.organization_id] ?? r.organization_id}</p>
                    {r.error && <p className="text-xs text-destructive truncate">{r.error}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{r.candidates} candidatas</Badge>
                    {!lastResponse.dry_run && (
                      <Badge variant={r.status === "success" ? (r.partial ? "secondary" : "default") : r.status === "error" ? "destructive" : "secondary"}>
                        {r.requeued} reencoladas{r.partial ? " (parcial)" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
                {r.batches && r.batches.length > 1 && (
                  <div className="flex flex-wrap gap-1 pl-1">
                    {r.batches.map((b) => (
                      <Badge
                        key={b.index}
                        variant={b.status === "success" ? "outline" : "destructive"}
                        className="text-[10px] font-mono"
                        title={b.error}
                      >
                        L{b.index}: {b.requeued}/{b.candidates}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
