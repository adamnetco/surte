import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Violation {
  id: string;
  effective_directive: string | null;
  blocked_uri: string | null;
  source_file: string | null;
  line_number: number | null;
  document_uri: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Aggregate {
  directive: string;
  blocked: string;
  count: number;
  last_seen: string;
}

export default function CspViolationsPage() {
  const [rows, setRows] = useState<Violation[]>([]);
  const [agg, setAgg] = useState<Aggregate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("csp_violations")
      .select("id, effective_directive, blocked_uri, source_file, line_number, document_uri, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as Violation[];
    setRows(list);

    // Agregación local: agrupa por (directive, blocked_uri)
    const map = new Map<string, Aggregate>();
    for (const v of list) {
      const key = `${v.effective_directive ?? "?"}::${v.blocked_uri ?? "?"}`;
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
        if (v.created_at > cur.last_seen) cur.last_seen = v.created_at;
      } else {
        map.set(key, {
          directive: v.effective_directive ?? "?",
          blocked: v.blocked_uri ?? "?",
          count: 1,
          last_seen: v.created_at,
        });
      }
    }
    setAgg(Array.from(map.values()).sort((a, b) => b.count - a.count));
    setLoading(false);
  };

  useEffect(() => { load(); document.title = "CSP · Violaciones · Superadmin"; }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-primary" size={20} />
          <h2 className="font-heading font-bold text-xl">Violaciones CSP (report-only)</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Recargar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Resumen por dominio bloqueado</CardTitle>
        </CardHeader>
        <CardContent>
          {agg.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin violaciones registradas. El listener se acaba de desplegar; los datos llegarán en cuanto los usuarios visiten la app.
            </p>
          ) : (
            <div className="space-y-2">
              {agg.map((a) => (
                <div key={`${a.directive}::${a.blocked}`} className="flex items-center justify-between border-b border-border py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-muted-foreground">{a.directive}</div>
                    <div className="truncate">{a.blocked}</div>
                  </div>
                  <Badge variant="secondary">{a.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Últimas 200 violaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="pr-2">Directiva</th>
                    <th className="pr-2">Blocked URI</th>
                    <th className="pr-2">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id} className="border-t border-border">
                      <td className="py-1 pr-2 whitespace-nowrap">{new Date(v.created_at).toLocaleString("es-CO")}</td>
                      <td className="pr-2 font-mono">{v.effective_directive}</td>
                      <td className="pr-2 truncate max-w-[280px]" title={v.blocked_uri ?? ""}>{v.blocked_uri}</td>
                      <td className="pr-2 truncate max-w-[200px]" title={`${v.source_file}:${v.line_number}`}>
                        {v.source_file ? `${v.source_file.split("/").pop()}:${v.line_number ?? "?"}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
