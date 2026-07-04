import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AUTO_LOCK_OPTIONS,
  getAutoLockMinutes,
  setAutoLockMinutes,
  getRequirePinForCharge,
  setRequirePinForCharge,
  hasPinConfigured,
} from "@/lib/posPinPrefs";

/**
 * Ajustes locales de seguridad del POS por usuario.
 * Se guardan en localStorage por-userId (no viajan al backend). Aplican al POSPinLock.
 */
export default function POSSecuritySettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [autoLock, setAutoLock] = useState<number>(3);
  const [requireCharge, setRequireCharge] = useState<boolean>(false);
  const [pinConfigured, setPinConfigured] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        setAutoLock(getAutoLockMinutes(uid));
        setRequireCharge(getRequirePinForCharge(uid));
        setPinConfigured(hasPinConfigured(uid));
      }
    });
  }, []);

  if (!userId) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-base">Seguridad del POS</h3>
          <p className="text-xs text-muted-foreground">
            Ajustes locales de este dispositivo/usuario. No requieren conexión.
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
            pinConfigured
              ? "bg-primary/10 border-primary/40 text-primary"
              : "bg-muted border-border text-muted-foreground"
          )}
        >
          PIN {pinConfigured ? "activo" : "no configurado"}
        </span>
      </div>

      {/* Auto-lock */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          Bloqueo automático por inactividad
        </Label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {AUTO_LOCK_OPTIONS.map((opt) => {
            const active = autoLock === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setAutoLock(opt.value); setAutoLockMinutes(userId, opt.value); }}
                className={cn(
                  "h-10 rounded-lg border text-xs font-semibold transition-colors touch-manipulation active:scale-95",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border hover:border-primary/40"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Se bloquea el POS tras N minutos sin actividad. "Nunca" desactiva el auto-lock (el botón manual sigue disponible).
        </p>
      </div>

      {/* PIN antes de COBRAR */}
      <div className="flex items-start gap-3 pt-2 border-t">
        <div className="flex-1">
          <Label className="text-sm font-semibold">Exigir PIN al cobrar</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Antes de abrir el diálogo de pago, el POS pide reconfirmar el PIN. Útil en cajas compartidas o mientras el cajero se aleja.
          </p>
          {!pinConfigured && (
            <p className="text-[11px] text-accent mt-1 font-medium">
              Configura primero un PIN en el POS (botón "Bloquear" abajo-izquierda) para activar esta opción.
            </p>
          )}
        </div>
        <Switch
          checked={requireCharge}
          disabled={!pinConfigured}
          onCheckedChange={(v) => { setRequireCharge(v); setRequirePinForCharge(userId, v); }}
        />
      </div>
    </div>
  );
}
