import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Search } from "lucide-react";

type Grants = Partial<Record<"anon" | "authenticated" | "service_role", string[]>>;
type Policy = { name: string; cmd: string; roles: string[] | null; qual: string | null; check: string | null };
type TableRow = {
  name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  grants: Grants;
  policy_count: number;
  policies: Policy[];
};
type AuditResult = { generated_at: string; tables: TableRow[] };

function severity(row: TableRow): "ok" | "warn" | "danger" {
  if (!row.rls_enabled) return "danger";
  if (row.policy_count === 0) return "danger";
  const hasAuth = (row.grants.authenticated?.length ?? 0) > 0;
  const hasSvc = (row.grants.service_role?.length ?? 0) > 0;
  if (!hasAuth && !hasSvc) return "danger";
  if (!hasSvc) return "warn";
  return "ok";
}

const sevStyles: Record<string, string> = {
  ok: "border-success/30 bg-success/5",
  warn: "border-warning/40 bg-warning/5",
  danger: "border-destructive/50 bg-destructive/5",
};

const sevIcon = {
  ok: <CheckCircle2 className="w-4 h-4 text-success" />,
  warn: <AlertTriangle className="w-4 h-4 text-warning" />,
  danger: <ShieldAlert className="w-4 h-4 text-destructive" />,
} as const;

const GrantBadge = ({ role, privs }: { role: string; privs?: string[] }) => {
  const has = (privs?.length ?? 0) > 0;
  return (
    <Badge variant={has ? "secondary" : "outline"} className={`text-[10px] ${has ? "" : "opacity-50 line-through"}`}>
      {role}{has ? `: ${privs!.join(",")}` : ""}
    </Badge>
  );
};

export default function DiagnosticoRLS() {
  const [data, setData] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "issues">("issues");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data: res, error } = await supabase.rpc("audit_public_rls" as never);
    if (error) {
      setErr(error.message);
    } else {
      setData(res as unknown as AuditResult);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Diagnóstico RLS · Superadmin · SistecPOS";
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.tables.filter((t) => {
      if (filter === "issues" && severity(t) === "ok") return false;
      if (term && !t.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data, q, filter]);

  const stats = useMemo(() => {
    const s = { total: 0, ok: 0, warn: 0, danger: 0 };
    data?.tables.forEach((t) => {
      s.total++;
      s[severity(t)]++;
    });
    return s;
  }, [data]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Diagnóstico RLS</h1>
          <p className="text-sm text-muted-foreground">Estado de Row-Level Security, GRANTs y políticas para cada tabla de <code>public</code>.</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Re-verificar
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-[11px] uppercase text-muted-foreground">Total tablas</p><p className="text-2xl font-bold">{stats.total}</p></Card>
        <Card className="p-3 border-success/30"><p className="text-[11px] uppercase text-muted-foreground">OK</p><p className="text-2xl font-bold text-success">{stats.ok}</p></Card>
        <Card className="p-3 border-warning/40"><p className="text-[11px] uppercase text-muted-foreground">Advertencias</p><p className="text-2xl font-bold text-warning">{stats.warn}</p></Card>
        <Card className="p-3 border-destructive/50"><p className="text-[11px] uppercase text-muted-foreground">Críticas</p><p className="text-2xl font-bold text-destructive">{stats.danger}</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tabla…" className="pl-8 h-9" />
        </div>
        <div className="inline-flex border rounded-md p-0.5 bg-card">
          <button onClick={() => setFilter("issues")} className={`px-3 h-8 text-xs rounded ${filter === "issues" ? "bg-primary text-primary-foreground" : ""}`}>Solo problemas</button>
          <button onClick={() => setFilter("all")} className={`px-3 h-8 text-xs rounded ${filter === "all" ? "bg-primary text-primary-foreground" : ""}`}>Todas</button>
        </div>
        {data && <span className="text-[11px] text-muted-foreground ml-auto">Generado: {new Date(data.generated_at).toLocaleString("es-CO")}</span>}
      </div>

      {err && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm">
          <p className="font-semibold text-destructive">No se pudo ejecutar el diagnóstico</p>
          <p className="text-muted-foreground">{err}</p>
        </Card>
      )}

      {loading && !data && (
        <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-20 animate-pulse bg-muted/40" />)}</div>
      )}

      <div className="grid gap-2">
        {filtered.map((row) => {
          const sev = severity(row);
          return (
            <Card key={row.name} className={`p-3 ${sevStyles[sev]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {sevIcon[sev]}
                  <code className="font-mono text-sm font-semibold">{row.name}</code>
                  {!row.rls_enabled && <Badge variant="destructive" className="text-[10px]">RLS OFF</Badge>}
                  {row.rls_enabled && row.policy_count === 0 && <Badge variant="destructive" className="text-[10px]">SIN POLÍTICAS</Badge>}
                  {row.policy_count > 0 && <Badge variant="outline" className="text-[10px]">{row.policy_count} polic.</Badge>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <GrantBadge role="anon" privs={row.grants.anon} />
                  <GrantBadge role="authenticated" privs={row.grants.authenticated} />
                  <GrantBadge role="service_role" privs={row.grants.service_role} />
                </div>
              </div>
              {row.policies.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">Ver políticas</summary>
                  <ul className="mt-2 space-y-1 text-[11px] font-mono">
                    {row.policies.map((p) => (
                      <li key={p.name} className="border-l-2 border-border pl-2">
                        <span className="text-primary">{p.cmd}</span> · <span className="font-semibold">{p.name}</span>
                        {p.qual && <div className="text-muted-foreground break-all">USING ({p.qual})</div>}
                        {p.check && <div className="text-muted-foreground break-all">CHECK ({p.check})</div>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          );
        })}
        {!loading && filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {filter === "issues" ? "🎉 No hay tablas con problemas detectados." : "Sin resultados."}
          </Card>
        )}
      </div>
    </div>
  );
}
