import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Store, Sparkles } from "lucide-react";
import { useOrganization } from "@/context/OrganizationContext";
import { usePOSModes } from "@/hooks/usePOSModes";
import { POS_MODES, ALL_POS_MODES, type PosMode } from "@/lib/posModes";
import { POS_BUSINESS_PRESETS, type PosBusinessPreset } from "@/lib/posBusinessPresets";
import { cn } from "@/lib/utils";

/**
 * Configuración por organización: plantilla por nicho + qué modos POS están activos.
 * Un minimarket podría activar solo Autoservicio + Domicilio, un restaurante Mesa + Domicilio + Consumo, etc.
 */
export default function POSModesSettings() {
  const { currentOrg } = useOrganization();
  const { config, loading, save } = usePOSModes(currentOrg?.id);
  const [enabled, setEnabled] = useState<PosMode[]>(config.enabled);
  const [defaultMode, setDefaultMode] = useState<PosMode>(config.default);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(config.enabled);
    setDefaultMode(config.default);
  }, [config]);

  const toggle = (m: PosMode) => {
    setEnabled((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      if (next.length === 0) return prev; // siempre al menos 1
      if (!next.includes(defaultMode)) setDefaultMode(next[0]);
      return next;
    });
  };

  const applyPreset = (preset: PosBusinessPreset) => {
    setEnabled(preset.enabled);
    setDefaultMode(preset.default);
    toast.info(`Plantilla "${preset.label}" cargada. Recuerda guardar.`);
  };

  const handleSave = async () => {
    if (enabled.length === 0) {
      toast.error("Debe haber al menos un modo activo");
      return;
    }
    setSaving(true);
    try {
      await save({ enabled, default: defaultMode });
      toast.success("Modos POS actualizados");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando configuración POS…
      </div>
    );
  }

  // Detecta si la config actual coincide con una plantilla.
  const matchedPreset = POS_BUSINESS_PRESETS.find(
    (p) =>
      p.default === defaultMode &&
      p.enabled.length === enabled.length &&
      p.enabled.every((m) => enabled.includes(m))
  );

  return (
    <div className="rounded-lg border bg-card p-4 space-y-5">
      <div className="flex items-start gap-2">
        <Store className="w-5 h-5 text-primary mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-base">Modos de venta del POS</h3>
          <p className="text-xs text-muted-foreground">
            Activa solo las modalidades que aplican a tu negocio. El cajero verá únicamente las activas en la barra superior del POS.
          </p>
        </div>
      </div>

      {/* Plantillas por nicho */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <Label className="text-sm font-semibold">Plantillas por tipo de negocio</Label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Aplica una plantilla para pre-configurar los modos. Luego puedes ajustar manualmente.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {POS_BUSINESS_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive = matchedPreset?.key === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "text-left rounded-lg border p-2.5 transition-all active:scale-[0.98]",
                  isActive
                    ? "border-accent bg-accent/5 ring-1 ring-accent/40"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", isActive ? "text-accent" : "text-primary")} />
                  <span className="text-sm font-semibold truncate">{preset.label}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] font-bold uppercase text-accent">Actual</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modos individuales */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-sm font-semibold">Modos disponibles</Label>
        <div className="grid sm:grid-cols-2 gap-3">
          {ALL_POS_MODES.map((m) => {
            const meta = POS_MODES[m];
            const Icon = meta.icon;
            const isOn = enabled.includes(m);
            const isDefault = defaultMode === m;
            return (
              <div
                key={m}
                className={cn(
                  "rounded-lg border p-3 flex items-start gap-3 transition-colors",
                  isOn ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
                )}
              >
                <Icon className={cn("w-5 h-5 mt-0.5", isOn ? "text-accent" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="font-semibold text-sm cursor-pointer" onClick={() => toggle(m)}>
                      {meta.label}
                    </Label>
                    <Switch checked={isOn} onCheckedChange={() => toggle(m)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
                  {isOn && (
                    <button
                      type="button"
                      onClick={() => setDefaultMode(m)}
                      className={cn(
                        "mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors",
                        isDefault
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border text-muted-foreground hover:text-primary hover:border-primary"
                      )}
                    >
                      {isDefault ? "✓ Modo por defecto" : "Usar por defecto"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar modos
      </Button>
    </div>
  );
}
