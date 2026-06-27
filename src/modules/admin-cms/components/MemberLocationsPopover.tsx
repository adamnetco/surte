/**
 * MemberLocationsPopover — Asigna sucursales a un miembro.
 *
 * Si el array `location_ids` queda vacío => acceso a TODAS las sucursales
 * (regla aplicada por RLS/Context).
 * Owners/admins siempre ven todas, así que para ellos se muestra solo informativo.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Store, Loader2, Globe, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Loc { id: string; name: string; city: string | null; is_main: boolean }

interface Props {
  memberId: string;
  role: string;
  value: string[] | null;
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export default function MemberLocationsPopover({ memberId, role, value, onChange, disabled }: Props) {
  const { currentOrg } = useOrganization();
  const [open, setOpen] = useState(false);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [selected, setSelected] = useState<string[]>(value ?? []);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPrivileged = role === "owner" || role === "admin";

  useEffect(() => setSelected(value ?? []), [value]);

  useEffect(() => {
    if (!open || !currentOrg) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("locations")
        .select("id, name, city, is_main")
        .eq("organization_id", currentOrg.id)
        .eq("is_active", true)
        .order("is_main", { ascending: false })
        .order("name");
      setLocs((data as Loc[]) ?? []);
      setLoading(false);
    })();
  }, [open, currentOrg]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    // Vacío => null = acceso a todas
    const payload = selected.length === 0 ? null : selected;
    const { error } = await supabase
      .from("organization_members")
      .update({ location_ids: payload as any })
      .eq("id", memberId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(payload ? `Acceso restringido a ${selected.length} sucursal(es)` : "Acceso a todas las sucursales");
    onChange(selected);
    setOpen(false);
  };

  const count = (value ?? []).length;
  const labelText = isPrivileged
    ? "Todas (privilegio de rol)"
    : count === 0
      ? "Todas"
      : `${count} sucursal${count > 1 ? "es" : ""}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || isPrivileged}
          className="h-7 px-2 gap-1 text-[11px]"
          aria-label="Gestionar sucursales del miembro"
        >
          {isPrivileged || count === 0 ? <Globe className="h-3 w-3" /> : <Store className="h-3 w-3" />}
          <span className="truncate max-w-[120px]">{labelText}</span>
          {!disabled && !isPrivileged && <ChevronDown className="h-3 w-3 opacity-60" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 bg-popover z-50">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold">Sucursales permitidas</p>
            <p className="text-[10px] text-muted-foreground">
              Sin selección = acceso a todas las sucursales.
            </p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
            </div>
          ) : locs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Esta organización no tiene sucursales.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {locs.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 cursor-pointer text-xs"
                >
                  <Checkbox checked={selected.includes(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.name}</p>
                    {l.city && <p className="text-[10px] text-muted-foreground truncate">{l.city}</p>}
                  </div>
                  {l.is_main && <Badge variant="outline" className="text-[9px]">Principal</Badge>}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setSelected([])}>
              Todas
            </Button>
            <Button size="sm" className="flex-1" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
