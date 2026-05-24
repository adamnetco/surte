import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AdminSectionAccess from "@/components/admin/AdminSectionAccess";
import { pendingCount, flushOutbox } from "@/lib/offline/outbox";
import { getMeta } from "@/lib/offline/db";
import { APP_VERSION, APP_BUILD_DATE } from "@/lib/version";
import { Activity, Database, Inbox, Tag, RefreshCw, Wifi, WifiOff, CloudUpload } from "lucide-react";
import { toast } from "sonner";

type Check = { label: string; status: "ok" | "fail" | "warn" | "info"; detail: string };

interface SystemHealth {
  backend: "ok" | "down" | "checking";
  backendLatencyMs: number | null;
  outboxPending: number;
  online: boolean;
}

const SECTIONS = ["admin", "productos", "pedidos", "inventario"];


const AdminDiag = () => {
  const { user, session, role, isAdmin, isAgent, loading } = useAuth();
  const location = useLocation();
  const deniedState = (location.state ?? {}) as { denied?: boolean; section?: string; allowed?: string[] };
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(true);
  const [rpcRole, setRpcRole] = useState<string | null>(null);
  const [rolesRows, setRolesRows] = useState<any[]>([]);
  const [reason, setReason] = useState<string>("");
  const [sectionAccess, setSectionAccess] = useState<Record<string, { allowed: string[]; can: boolean }>>({});
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [forcingSync, setForcingSync] = useState(false);
  const [health, setHealth] = useState<SystemHealth>({
    backend: "checking",
    backendLatencyMs: null,
    outboxPending: 0,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  });

  const forceSync = async () => {
    setForcingSync(true);
    try {
      const { sent, failed, skipped } = await flushOutbox();
      if (sent > 0) toast.success(`${sent} operación(es) sincronizadas`);
      if (failed > 0) toast.error(`${failed} fallaron · reintentaremos`);
      if (sent === 0 && failed === 0) toast.info(skipped > 0 ? `${skipped} en espera (backoff)` : "Sin operaciones pendientes");
      const ts = await getMeta<number>("last_sync_success_at");
      if (ts) setLastSyncAt(ts);
      const n = await pendingCount();
      setHealth((h) => ({ ...h, outboxPending: n }));
    } catch (e: any) {
      toast.error(`Error: ${e?.message ?? e}`);
    } finally {
      setForcingSync(false);
    }
  };

  const refreshHealth = async () => {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setHealth((h) => ({ ...h, backend: "checking", online }));
    const started = performance.now();
    let backend: "ok" | "down" = "down";
    let latency: number | null = null;
    try {
      // Cheap, RLS-safe ping. Falls back to "down" on any timeout/network error.
      const { error } = await (supabase as any)
        .from("admin_section_access")
        .select("section_key", { head: true, count: "exact" })
        .limit(1);
      if (!error) backend = "ok";
      latency = Math.round(performance.now() - started);
    } catch {
      backend = "down";
    }
    let outboxPending = 0;
    try { outboxPending = await pendingCount(); } catch { /* dexie unavailable */ }
    setHealth({ backend, backendLatencyMs: latency, outboxPending, online });
  };


  const run = async () => {
    setRunning(true);
    const out: Check[] = [];

    // 1. Session
    const { data: sessData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) out.push({ label: "supabase.auth.getSession()", status: "fail", detail: sessErr.message });
    else if (!sessData.session) out.push({ label: "Sesión activa", status: "fail", detail: "No hay sesión. Inicia sesión en /login." });
    else out.push({ label: "Sesión activa", status: "ok", detail: `user_id: ${sessData.session.user.id} · expira: ${new Date(sessData.session.expires_at! * 1000).toLocaleString()}` });

    const uid = sessData.session?.user.id;

    // 2. RPC get_current_user_role
    if (uid) {
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc("get_current_user_role");
      if (rpcErr) out.push({ label: "RPC get_current_user_role", status: "fail", detail: rpcErr.message });
      else {
        setRpcRole(rpcData);
        out.push({ label: "RPC get_current_user_role", status: rpcData ? "ok" : "warn", detail: `Devolvió: ${JSON.stringify(rpcData)}` });
      }

      // 3. user_roles directo
      const { data: rolesData, error: rolesErr } = await supabase.from("user_roles").select("role, created_at").eq("user_id", uid);
      if (rolesErr) out.push({ label: "SELECT user_roles", status: "fail", detail: `${rolesErr.code}: ${rolesErr.message}` });
      else {
        setRolesRows(rolesData ?? []);
        out.push({ label: "SELECT user_roles", status: (rolesData?.length ?? 0) > 0 ? "ok" : "fail", detail: `${rolesData?.length ?? 0} fila(s): ${JSON.stringify(rolesData)}` });
      }
    }

    // 4. Contexto
    out.push({ label: "AuthContext.role", status: ["superadmin", "admin", "editor"].includes(role) ? "ok" : "warn", detail: role });
    out.push({ label: "AuthContext.isAdmin", status: isAdmin ? "ok" : "info", detail: String(isAdmin) });
    out.push({ label: "AuthContext.loading", status: loading ? "warn" : "ok", detail: String(loading) });

    // 5. Accesos por sección (admin_section_access + can_access_section)
    const accessMap: Record<string, { allowed: string[]; can: boolean }> = {};
    for (const section of SECTIONS) {
      const { data: cfg } = await (supabase as any)
        .from("admin_section_access")
        .select("allowed_roles")
        .eq("section_key", section)
        .maybeSingle();
      const { data: can } = await (supabase as any).rpc("can_access_section", { _section: section });
      accessMap[section] = { allowed: (cfg?.allowed_roles as string[]) ?? [], can: Boolean(can) };
      out.push({
        label: `Sección "${section}"`,
        status: can ? "ok" : "fail",
        detail: `permitido: [${(cfg?.allowed_roles ?? []).join(", ")}] · puedes acceder: ${Boolean(can)}`,
      });
    }
    setSectionAccess(accessMap);

    // 6. Motivo de bloqueo
    let why = "";
    if (deniedState.denied) {
      why = `Bloqueado por guard al intentar acceder a sección "${deniedState.section}". Tu rol "${role}" no está en [${(deniedState.allowed ?? []).join(", ")}].`;
    } else if (loading) why = "Aún cargando AuthContext (loading=true). Espera o revisa timeouts.";
    else if (!sessData.session) why = "No hay sesión activa. Inicia sesión.";
    else if (!accessMap["admin"]?.can) why = `Rol actual "${role}" no autorizado para /admin. Roles permitidos: [${accessMap["admin"]?.allowed.join(", ")}].`;
    else why = "✓ Acceso autorizado — no hay bloqueo.";
    setReason(why);

    setChecks(out);
    setRunning(false);
    void refreshHealth();
  };

  useEffect(() => {
    if (loading) return; // espera a que AuthContext termine antes de ejecutar checks
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Refresh outbox count + online status + lastSyncAt every 10s.
  useEffect(() => {
    const tick = async () => {
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      let outboxPending = 0;
      try { outboxPending = await pendingCount(); } catch { /* dexie unavailable */ }
      try {
        const ts = await getMeta<number>("last_sync_success_at");
        if (ts) setLastSyncAt(ts);
      } catch { /* no-op */ }
      setHealth((h) => ({ ...h, online, outboxPending }));
    };
    void tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);


  const color = (s: Check["status"]) =>
    s === "ok" ? "text-green-600 border-green-200 bg-green-50" :
    s === "fail" ? "text-red-600 border-red-200 bg-red-50" :
    s === "warn" ? "text-amber-600 border-amber-200 bg-amber-50" :
    "text-slate-600 border-slate-200 bg-slate-50";

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-heading font-bold text-primary">Diagnóstico /admin</h1>
        <div className="flex gap-2">
          <button onClick={run} disabled={running} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
            {running ? "Ejecutando…" : "Reintentar"}
          </button>
          <Link to="/admin" className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground">Ir a /admin</Link>
        </div>
      </header>

      {/* Salud del Sistema */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Salud del Sistema
          </h2>
          <button
            onClick={refreshHealth}
            className="text-xs px-2 py-1 rounded-md border border-border hover:bg-muted flex items-center gap-1"
            aria-label="Refrescar salud"
          >
            <RefreshCw className="w-3 h-3" /> Refrescar
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className={`rounded border p-2.5 ${
            health.backend === "ok" ? "border-green-200 bg-green-50" :
            health.backend === "down" ? "border-red-200 bg-red-50" :
            "border-slate-200 bg-slate-50"
          }`}>
            <div className="flex items-center gap-1.5 font-semibold mb-1"><Database className="w-3 h-3" /> Backend</div>
            <p className="opacity-90">
              {health.backend === "ok" && `✓ Conectado${health.backendLatencyMs != null ? ` · ${health.backendLatencyMs} ms` : ""}`}
              {health.backend === "down" && "✗ Sin respuesta"}
              {health.backend === "checking" && "Probando…"}
            </p>
          </div>
          <div className={`rounded border p-2.5 ${health.online ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center gap-1.5 font-semibold mb-1"><Activity className="w-3 h-3" /> Red</div>
            <p className="opacity-90">{health.online ? "✓ En línea" : "✗ Sin conexión"}</p>
          </div>
          <div className={`rounded border p-2.5 ${health.outboxPending > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
            <div className="flex items-center gap-1.5 font-semibold mb-1"><Inbox className="w-3 h-3" /> Outbox</div>
            <p className="opacity-90">
              {health.outboxPending} pendiente{health.outboxPending === 1 ? "" : "s"} de sincronizar
            </p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-1.5 font-semibold mb-1"><Tag className="w-3 h-3" /> Versión</div>
            <p className="opacity-90">
              v{APP_VERSION} · <span className="text-[10px]">{APP_BUILD_DATE}</span>
            </p>
          </div>
        </div>
      </section>

      <section className={`rounded-lg border p-4 ${reason.startsWith("✓") ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Motivo de autorización</p>
        <p className="text-sm font-medium">{reason || "Calculando…"}</p>
      </section>


      <section className="rounded-lg border border-border bg-card p-4 space-y-1 text-sm">
        <p><span className="text-muted-foreground">Email:</span> <code>{user?.email ?? "—"}</code></p>
        <p><span className="text-muted-foreground">User ID:</span> <code className="text-xs">{user?.id ?? "—"}</code></p>
        <p><span className="text-muted-foreground">Rol detectado (contexto):</span> <code>{role}</code></p>
        <p><span className="text-muted-foreground">Rol vía RPC:</span> <code>{rpcRole ?? "—"}</code></p>
        <p><span className="text-muted-foreground">Filas en user_roles:</span> <code>{rolesRows.length}</code> {rolesRows.length > 0 && <span>· {rolesRows.map(r => r.role).join(", ")}</span>}</p>
        <p><span className="text-muted-foreground">isAdmin / isAgent / loading:</span> <code>{String(isAdmin)} / {String(isAgent)} / {String(loading)}</code></p>
        <p><span className="text-muted-foreground">Sesión expira:</span> <code className="text-xs">{session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "—"}</code></p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Checks</h2>
        {checks.map((c, i) => (
          <div key={i} className={`rounded-md border px-3 py-2 text-sm ${color(c.status)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{c.label}</span>
              <span className="text-[10px] uppercase tracking-wider">{c.status}</span>
            </div>
            <p className="text-xs mt-1 break-all opacity-90">{c.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Accesos por sección (en vivo)</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(sectionAccess).map(([k, v]) => (
            <div key={k} className={`rounded border p-2 ${v.can ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className="font-semibold">{k}</p>
              <p className="opacity-80">roles: [{v.allowed.join(", ")}]</p>
              <p className="opacity-80">acceso: {v.can ? "✓ permitido" : "✗ denegado"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <AdminSectionAccess />
      </section>


      <footer className="text-xs text-muted-foreground pt-4 border-t border-border">
        Si el RPC falla pero <code>user_roles</code> tiene tu fila, la función SQL <code>get_current_user_role</code> no está deployada.
        Si <code>user_roles</code> está vacío, asigna tu rol desde el panel o ejecuta el INSERT correspondiente.
      </footer>
    </div>
  );
};

export default AdminDiag;
