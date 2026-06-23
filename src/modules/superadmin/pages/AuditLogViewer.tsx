import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Filter, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AuditRow {
  id: string;
  organization_id: string | null;
  organization_slug: string | null;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const actionColor = (a: string): string => {
  if (a.includes("critical_action_approved")) return "bg-emerald-100 text-emerald-900";
  if (a.includes("critical_action_rejected")) return "bg-red-100 text-red-900";
  if (a.includes("critical")) return "bg-amber-100 text-amber-900";
  if (a.includes("lifecycle")) return "bg-blue-100 text-blue-900";
  if (a.includes("override")) return "bg-purple-100 text-purple-900";
  if (a.includes("delete") || a.includes("archive")) return "bg-red-50 text-red-800";
  return "bg-muted text-muted-foreground";
};

export default function AuditLogViewer() {
  const [actionFilter, setActionFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [limit, setLimit] = useState(100);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tenant-audit-log", actionFilter, orgFilter, limit],
    queryFn: async () => {
      let q = supabase
        .from("tenant_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (actionFilter) q = q.ilike("action", `%${actionFilter}%`);
      if (orgFilter) q = q.ilike("organization_slug", `%${orgFilter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  const stats = useMemo(() => {
    const arr = data ?? [];
    const byAction = new Map<string, number>();
    arr.forEach((r) => byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1));
    return {
      total: arr.length,
      uniqueActions: byAction.size,
      uniqueOrgs: new Set(arr.map((r) => r.organization_slug).filter(Boolean)).size,
    };
  }, [data]);

  const exportCsv = () => {
    if (!data?.length) return;
    const headers = ["created_at", "organization_slug", "actor_email", "action", "payload"];
    const rows = data.map((r) =>
      [
        r.created_at,
        r.organization_slug ?? "",
        r.actor_email ?? "",
        r.action,
        JSON.stringify(r.payload ?? {}),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> Audit log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trazabilidad completa de cambios de ciclo de vida, overrides de entitlements y acciones críticas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.length}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Eventos</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Tipos</p><p className="text-2xl font-bold">{stats.uniqueActions}</p></CardContent></Card>
        <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Tiendas</p><p className="text-2xl font-bold">{stats.uniqueOrgs}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Acción (ej: critical, lifecycle)"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <Input
            placeholder="Slug de tienda"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value={50}>50 filas</option>
            <option value={100}>100 filas</option>
            <option value={250}>250 filas</option>
            <option value={500}>500 filas</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refrescar</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="h-40 bg-muted animate-pulse rounded" />
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sin eventos para los filtros aplicados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data!.map((row) => (
            <Card key={row.id}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={actionColor(row.action)}>{row.action}</Badge>
                    {row.organization_slug && (
                      <Badge variant="outline">{row.organization_slug}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("es-CO")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Actor: <span className="font-medium">{row.actor_email ?? row.actor_id ?? "system"}</span>
                </p>
                {row.payload && Object.keys(row.payload).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver payload
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-[11px]">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
