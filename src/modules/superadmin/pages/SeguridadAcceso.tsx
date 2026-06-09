import { useEffect, useState } from "react";
import { ShieldCheck, AlertCircle, Save, RotateCcw, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  loadAuthSettings,
  saveAuthSettings,
  resetAuthSettings,
  DEFAULT_AUTH_SETTINGS,
  METHOD_LABELS,
  ROLE_LABELS,
  type AuthSettings,
  type AuthMethodKey,
  type RoleKey,
  type IdleTimeouts,
} from "@/modules/auth/lib/authSettings";

/**
 * /superadmin/seguridad/acceso
 *
 * Panel para mutar `auth_settings`. Mientras Lovable Cloud está caído,
 * persiste en localStorage. Cuando vuelva, reemplazar `load/save` por
 * `supabase.from('auth_settings').select/upsert`.
 */
export default function SeguridadAccesoPage() {
  const [settings, setSettings] = useState<AuthSettings>(() => loadAuthSettings());
  const [dirty, setDirty] = useState(false);
  const [newApprover, setNewApprover] = useState("");
  const [newIp, setNewIp] = useState("");

  useEffect(() => {
    setDirty(JSON.stringify(settings) !== JSON.stringify(loadAuthSettings()));
  }, [settings]);

  const update = <K extends keyof AuthSettings>(key: K, value: AuthSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const toggleMethod = (m: AuthMethodKey) => {
    update(
      "methods_enabled",
      settings.methods_enabled.includes(m)
        ? settings.methods_enabled.filter((x) => x !== m)
        : [...settings.methods_enabled, m],
    );
  };

  const toggleRole = (r: RoleKey) => {
    update(
      "require_2fa_roles",
      settings.require_2fa_roles.includes(r)
        ? settings.require_2fa_roles.filter((x) => x !== r)
        : [...settings.require_2fa_roles, r],
    );
  };

  const updateIdle = (role: keyof IdleTimeouts, value: number) => {
    update("idle_timeout_minutes", { ...settings.idle_timeout_minutes, [role]: value });
  };

  const addApprover = () => {
    const email = newApprover.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email inválido");
      return;
    }
    if (settings.break_glass_approvers.includes(email)) {
      toast.error("Ya está en la lista");
      return;
    }
    update("break_glass_approvers", [...settings.break_glass_approvers, email]);
    setNewApprover("");
  };

  const addIp = () => {
    const cidr = newIp.trim();
    if (!cidr) return;
    update("superadmin_ip_allowlist", [...settings.superadmin_ip_allowlist, cidr]);
    setNewIp("");
  };

  const handleSave = () => {
    saveAuthSettings(settings);
    setDirty(false);
    toast.success("Borrador guardado localmente. Se persistirá al volver Cloud.");
  };

  const handleReset = () => {
    if (!window.confirm("¿Restaurar valores por defecto? Se perderán los cambios locales.")) return;
    resetAuthSettings();
    setSettings(DEFAULT_AUTH_SETTINGS);
    toast.success("Valores por defecto restaurados");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
            <ShieldCheck className="text-primary" /> Acceso & Seguridad
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Todo el sistema de acceso es configurable desde aquí. Cambios afectan login, 2FA, idle timeout y break-glass para todas las tiendas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw size={14} /> Restaurar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty}>
            <Save size={14} /> Guardar borrador
          </Button>
        </div>
      </header>

      <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p>
          <strong>Modo borrador:</strong> Lovable Cloud no está disponible. Los cambios se guardan en
          tu navegador y se sincronizarán a la tabla <code>auth_settings</code> cuando el backend vuelva.
        </p>
      </div>

      {/* Métodos habilitados */}
      <Card>
        <CardHeader>
          <CardTitle>Métodos de autenticación</CardTitle>
          <CardDescription>Qué métodos pueden usar los usuarios para iniciar sesión.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(METHOD_LABELS) as AuthMethodKey[]).map((m) => (
            <label key={m} className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/30 cursor-pointer">
              <Checkbox
                checked={settings.methods_enabled.includes(m)}
                onCheckedChange={() => toggleMethod(m)}
              />
              <span className="text-sm font-medium">{METHOD_LABELS[m]}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* 2FA enforcement */}
      <Card>
        <CardHeader>
          <CardTitle>Obligatoriedad de 2FA</CardTitle>
          <CardDescription>Roles que deben tener un segundo factor activo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {(Object.keys(ROLE_LABELS) as RoleKey[]).map((r) => (
              <label key={r} className="flex items-center gap-2 p-3 rounded-md border cursor-pointer">
                <Checkbox
                  checked={settings.require_2fa_roles.includes(r)}
                  onCheckedChange={() => toggleRole(r)}
                />
                <span className="text-sm">{ROLE_LABELS[r]}</span>
              </label>
            ))}
          </div>
          <div className="grid gap-2 max-w-xs">
            <Label>Ventana de gracia (días)</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={settings.enforce_2fa_grace_days}
              onChange={(e) => update("enforce_2fa_grace_days", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Días que tiene un usuario para activar 2FA antes de bloquear su acceso.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Superadmin */}
      <Card>
        <CardHeader>
          <CardTitle>Superadmin</CardTitle>
          <CardDescription>Endurecimiento adicional para la ruta `/superadmin/acceso`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border">
            <div>
              <p className="font-medium text-sm">Requiere Passkey</p>
              <p className="text-xs text-muted-foreground">El superadmin no puede usar solo password.</p>
            </div>
            <Switch
              checked={settings.superadmin_requires_passkey}
              onCheckedChange={(v) => update("superadmin_requires_passkey", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>IP allowlist (CIDR)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="190.85.0.0/16"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIp())}
              />
              <Button variant="outline" size="sm" onClick={addIp}>
                <Plus size={14} /> Añadir
              </Button>
            </div>
            {settings.superadmin_ip_allowlist.length === 0 ? (
              <p className="text-xs text-muted-foreground">Vacío = sin restricción de IP.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {settings.superadmin_ip_allowlist.map((cidr) => (
                  <li key={cidr} className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                    <code>{cidr}</code>
                    <button
                      onClick={() => update("superadmin_ip_allowlist", settings.superadmin_ip_allowlist.filter((c) => c !== cidr))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Break-glass */}
      <Card>
        <CardHeader>
          <CardTitle>Break-glass superadmin</CardTitle>
          <CardDescription>Recuperación de emergencia con aprobadores múltiples.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Método de verificación</Label>
            <div className="flex gap-2">
              {(["email", "email_and_totp"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => update("break_glass_method", m)}
                  className={`px-3 py-2 rounded-md border text-sm ${
                    settings.break_glass_method === m ? "border-primary bg-primary/5 text-primary" : "border-border"
                  }`}
                >
                  {m === "email" ? "Solo email" : "Email + TOTP"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aprobadores (mínimo 2)</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="approver@empresa.com"
                value={newApprover}
                onChange={(e) => setNewApprover(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addApprover())}
              />
              <Button variant="outline" size="sm" onClick={addApprover}>
                <Plus size={14} /> Añadir
              </Button>
            </div>
            {settings.break_glass_approvers.length < 2 && (
              <p className="text-xs text-destructive">
                Faltan {2 - settings.break_glass_approvers.length} aprobador(es) para activar break-glass.
              </p>
            )}
            <ul className="space-y-1">
              {settings.break_glass_approvers.map((email) => (
                <li key={email} className="flex items-center justify-between px-3 py-2 rounded-md border text-sm">
                  <span>{email}</span>
                  <button
                    onClick={() => update("break_glass_approvers", settings.break_glass_approvers.filter((e) => e !== email))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Idle timeout */}
      <Card>
        <CardHeader>
          <CardTitle>Idle timeout por rol (minutos)</CardTitle>
          <CardDescription>Cierre automático de sesión por inactividad.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          {(Object.keys(settings.idle_timeout_minutes) as (keyof IdleTimeouts)[]).map((role) => (
            <div key={role} className="space-y-1">
              <Label className="text-xs">{ROLE_LABELS[role]}</Label>
              <Input
                type="number"
                min={1}
                value={settings.idle_timeout_minutes[role]}
                onChange={(e) => updateIdle(role, Number(e.target.value))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rate limit & re-auth */}
      <Card>
        <CardHeader>
          <CardTitle>Límites y re-autenticación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Re-auth window (minutos)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.reauth_window_minutes}
              onChange={(e) => update("reauth_window_minutes", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Vigencia del step-up para acciones críticas.</p>
          </div>
          <div className="space-y-1">
            <Label>Rate limit (intentos / 15 min)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={settings.rate_limit_per_15min}
              onChange={(e) => update("rate_limit_per_15min", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Por IP y por email.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
