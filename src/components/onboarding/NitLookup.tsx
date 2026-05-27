/**
 * NitLookup — input de NIT con botón de autocompletar.
 * Intenta invocar la edge function 'nit-lookup' (a implementar contra
 * RUES/DIAN). Si no existe o falla, cae silenciosamente a entrada manual.
 */
import { useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export interface NitLookupResult {
  legal_name?: string;
  city?: string;
  regime?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onResolved?: (r: NitLookupResult) => void;
}

const cleanNit = (s: string) => s.replace(/[^\d-]/g, "");

export function NitLookup({ value, onChange, onResolved }: Props) {
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const lookup = async () => {
    const nit = cleanNit(value).replace(/-/g, "");
    if (nit.length < 6) {
      setHint("Ingresa un NIT válido para autocompletar.");
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const { data, error } = await supabase.functions.invoke("nit-lookup", { body: { nit } });
      if (error) throw error;
      if (data && (data.legal_name || data.city)) {
        onResolved?.(data as NitLookupResult);
        setHint(`Encontrado: ${data.legal_name ?? ""}${data.city ? " · " + data.city : ""}`);
      } else {
        setHint("No encontramos datos públicos. Sigue manualmente.");
      }
    } catch {
      // EF no disponible aún → no rompemos UX, solo dejamos entrada manual.
      setHint("Autocompletar no disponible. Continúa manualmente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="nit-input" className="text-sm font-medium">
        NIT <span className="text-muted-foreground font-normal">(opcional)</span>
      </Label>
      <div className="flex gap-2">
        <Input
          id="nit-input"
          value={value}
          onChange={(e) => onChange(cleanNit(e.target.value))}
          placeholder="901234567"
          inputMode="numeric"
          autoComplete="off"
          className="h-12 text-base"
        />
        <Button
          type="button"
          variant="outline"
          onClick={lookup}
          disabled={loading || !value}
          className="h-12 px-4 gap-2 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 min-h-[1rem]">
        {hint ? (
          <>
            <Sparkles className="h-3 w-3 text-primary" /> {hint}
          </>
        ) : (
          "Consultamos los datos públicos para ahorrarte escribir."
        )}
      </p>
    </div>
  );
}
