// Slice J — Drill-down: lista últimos jobs que aplicaron una regla específica.
// Consulta print_jobs filtrando por payload.routing.rules @> [{rule_id}].
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, RefreshCcw, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface JobRow {
  id: string;
  status: string;
  channel: string | null;
  kind: string | null;
  created_at: string;
  printer_id: string | null;
  payload: any;
}

interface Props {
  ruleId: string | null;
  ruleLabel: string;
  organizationId: string;
  printers: Array<{ id: string; name: string }>;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  printing: "bg-blue-100 text-blue-700",
};

export function RuleJobsDialog({ ruleId, ruleLabel, organizationId, printers, onClose }: Props) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!ruleId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("print_jobs")
      .select("id,status,channel,kind,created_at,printer_id,payload")
      .eq("organization_id", organizationId)
      .contains("payload", { routing: { rules: [{ rule_id: ruleId }] } })
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error) setJobs((data ?? []) as JobRow[]);
    setLoading(false);
  };

  useEffect(() => { if (ruleId) load(); /* eslint-disable-next-line */ }, [ruleId]);

  const printerName = (id: string | null) =>
    id ? printers.find((p) => p.id === id)?.name ?? id.slice(0, 8) : "—";

  return (
    <Dialog open={!!ruleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Jobs recientes — {ruleLabel}
          </DialogTitle>
          <DialogDescription>
            Últimos 30 trabajos de impresión donde se aplicó esta regla.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
        </div>

        <ScrollArea className="max-h-[60vh]">
          {jobs.length === 0 && !loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Sin jobs registrados para esta regla todavía.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => {
                const source = j.payload?.routing?.source ?? "—";
                const priority = (j.payload?.routing?.rules ?? []).find(
                  (r: any) => r.rule_id === ruleId,
                )?.priority;
                return (
                  <div key={j.id} className="border rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={STATUS_COLOR[j.status] ?? "bg-muted"}>{j.status}</Badge>
                        {j.channel && <Badge variant="outline" className="text-[10px]">{j.channel}</Badge>}
                        {j.kind && <Badge variant="secondary" className="text-[10px]">{j.kind}</Badge>}
                        <Badge variant="outline" className="text-[10px]">src: {source}</Badge>
                        {priority != null && (
                          <Badge variant="outline" className="text-[10px]">prio {priority}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Printer className="h-3 w-3" /> {printerName(j.printer_id)}
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: es })}</span>
                      </div>
                    </div>
                    <code className="text-[10px] text-muted-foreground">{j.id.slice(0, 8)}</code>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
