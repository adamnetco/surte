import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, RefreshCw, Trash2, Mail, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { detectTenant, isStorefrontTenant, isSystemTenant } from "@/modules/tenant/lib/subdomain";
import {
  readAuthLog,
  clearAuthLog,
  checkMagicLinkGate,
  resetMagicLinkAttempts,
  type AuthLogEntry,
} from "@/modules/auth/lib/authLog";

const levelColor: Record<AuthLogEntry["level"], string> = {
  info: "text-slate-700 bg-slate-50 border-slate-200",
  warn: "text-amber-700 bg-amber-50 border-amber-200",
  error: "text-red-700 bg-red-50 border-red-200",
  success: "text-green-700 bg-green-50 border-green-200",
};

const AuthStatus = () => {
  const { user, role, loading } = useAuth();
  const tenant = detectTenant();
  const [entries, setEntries] = useState<AuthLogEntry[]>([]);
  const [gate, setGate] = useState(checkMagicLinkGate());
  const [sessionInfo, setSessionInfo] = useState<{ uid?: string; email?: string; expiresAt?: string } | null>(null);
  const [profile, setProfile] = useState<{ organization_id: string | null; organization_slug?: string | null } | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refresh = async () => {
    setEntries(readAuthLog());
    setGate(checkMagicLinkGate());
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setSessionInfo({
        uid: data.session.user.id,
        email: data.session.user.email ?? undefined,
        expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000).toLocaleString() : undefined,
      });
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("organization_id, organization_slug")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (error) setProfileError(error.message);
      else setProfile(prof as any);
    } else {
      setSessionInfo(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => setGate(checkMagicLinkGate()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tenantKind = isStorefrontTenant(tenant) ? "storefront" : isSystemTenant(tenant) ? "sistema" : "desconocido";
  const reason = (() => {
    if (loading) return "AuthContext cargando…";
    if (!sessionInfo) return "No hay sesión activa. Usa el formulario en /admin/login o el enlace mágico.";
    if (!profile) return "Sesión activa, pero no se encontró fila en profiles para este usuario.";
    if (!profile.organization_id) return "Sesión OK, pero el profile no tiene organization_id (no podrá redirigirse a un tenant).";
    if (isStorefrontTenant(tenant) && profile.organization_slug && profile.organization_slug !== tenant)
      return `Slug detectado "${tenant}" no coincide con organization_slug "${profile.organization_slug}".`;
    return "✓ Todo en orden. Tenant detectado y profile vinculado correctamente.";
  })();

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-heading font-bold text-primary flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Estado de autenticación
        </h1>
        <div className="flex gap-2">
          <button onClick={refresh} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refrescar
          </button>
          <Link to="/admin/login" className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground">Ir al login</Link>
        </div>
      </header>

      <section className={`rounded-lg border p-4 ${reason.startsWith("✓") ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Diagnóstico
        </p>
        <p className="text-sm font-medium">{reason}</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-1 text-sm">
        <p><span className="text-muted-foreground">Tenant detectado:</span> <code>{tenant}</code> <span className="text-xs text-muted-foreground">({tenantKind})</span></p>
        <p><span className="text-muted-foreground">Host:</span> <code className="text-xs">{typeof window !== "undefined" ? window.location.hostname : "—"}</code></p>
        <p><span className="text-muted-foreground">Email sesión:</span> <code>{sessionInfo?.email ?? user?.email ?? "—"}</code></p>
        <p><span className="text-muted-foreground">User ID:</span> <code className="text-[11px]">{sessionInfo?.uid ?? user?.id ?? "—"}</code></p>
        <p><span className="text-muted-foreground">Rol (AuthContext):</span> <code>{role}</code></p>
        <p><span className="text-muted-foreground">profile.organization_id:</span> <code className="text-[11px]">{profile?.organization_id ?? "—"}</code></p>
        <p><span className="text-muted-foreground">profile.organization_slug:</span> <code>{profile?.organization_slug ?? "—"}</code></p>
        <p><span className="text-muted-foreground">Sesión expira:</span> <code className="text-xs">{sessionInfo?.expiresAt ?? "—"}</code></p>
        {profileError && <p className="text-red-600 text-xs">profiles error: {profileError}</p>}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" /> Enlace mágico — límite de intentos
        </h2>
        <div className="text-xs space-y-1">
          <p>Intentos usados: <code>{gate.attemptsUsed}</code> / {gate.attemptsMax} (ventana de 15 min)</p>
          {gate.allowed && <p className="text-green-700">✓ Puedes enviar otro enlace mágico ahora.</p>}
          {!gate.allowed && gate.reason === "cooldown" && (
            <p className="text-amber-700">⏳ Espera {Math.ceil((gate.remainingMs ?? 0) / 1000)}s antes de reenviar (cooldown).</p>
          )}
          {!gate.allowed && gate.reason === "max_attempts" && (
            <p className="text-red-700">✗ Máximo de intentos alcanzado. Reintenta en {Math.ceil((gate.remainingMs ?? 0) / 60000)} min.</p>
          )}
          <button
            onClick={() => { resetMagicLinkAttempts(); setGate(checkMagicLinkGate()); }}
            className="mt-2 text-xs px-2 py-1 rounded border border-border hover:bg-muted"
          >
            Reiniciar contador
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Log de autenticación ({entries.length})
          </h2>
          <button
            onClick={() => { clearAuthLog(); setEntries([]); }}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Limpiar
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay eventos registrados en esta sesión.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e, i) => (
              <li key={i} className={`rounded border px-2.5 py-1.5 text-xs ${levelColor[e.level]}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{e.event}</span>
                  <span className="text-[10px] opacity-70">{new Date(e.ts).toLocaleTimeString()}</span>
                </div>
                {e.detail && <p className="opacity-90 mt-0.5 break-words">{e.detail}</p>}
                {(e.tenant || e.email) && (
                  <p className="opacity-70 mt-0.5 text-[10px]">
                    {e.tenant && <>tenant: <code>{e.tenant}</code> </>}
                    {e.email && <>· email: <code>{e.email}</code></>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-xs text-muted-foreground pt-4 border-t border-border">
        Comparte esta pantalla con soporte si no logras ingresar. Incluye el motivo, tenant y los últimos eventos del log.
      </footer>
    </div>
  );
};

export default AuthStatus;
