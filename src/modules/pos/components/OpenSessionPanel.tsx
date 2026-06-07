import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Banknote, Store, Settings, AlertTriangle } from "lucide-react";
import { errorToMessage } from "@/lib/errors";

interface Props {
  organizationId: string;
  locations: { id: string; name: string }[];
  registers: { id: string; name: string; location_id: string }[];
  userId: string;
  onOpened: (s: any) => void;
}

const QUICK_BASES = [0, 50_000, 100_000, 200_000, 500_000];
const COP_COMPACT = (n: number) =>
  n === 0 ? "$0" : n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

const LS_LOC = "pos:last_location";
const LS_REG = "pos:last_register";

export default function OpenSessionPanel({ organizationId, locations, registers, userId, onOpened }: Props) {
  const navigate = useNavigate();

  // Restaurar última selección si existe y sigue siendo válida.
  const initialLoc =
    (typeof window !== "undefined" && locations.find((l) => l.id === localStorage.getItem(LS_LOC))?.id) ||
    locations[0]?.id ||
    "";
  const [locationId, setLocationId] = useState(initialLoc);
  const filteredRegs = registers.filter((r) => r.location_id === locationId);

  const initialReg =
    (typeof window !== "undefined" && filteredRegs.find((r) => r.id === localStorage.getItem(LS_REG))?.id) ||
    filteredRegs[0]?.id ||
    "";
  const [registerId, setRegisterId] = useState(initialReg);
  const [opening, setOpening] = useState("0");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const first = registers.find((r) => r.location_id === locationId);
    setRegisterId((prev) => {
      // Si la caja recordada es válida para esta sede, conservarla.
      if (registers.find((r) => r.id === prev && r.location_id === locationId)) return prev;
      return first?.id ?? "";
    });
  }, [locationId, registers]);

  const open = async () => {
    if (!locationId || !registerId) return toast.error("Selecciona sede y caja");
    setBusy(true);
    const amount = Number(opening) || 0;
    try {
      const { data, error } = await supabase
        .from("cash_sessions")
        .insert({
          organization_id: organizationId,
          location_id: locationId,
          cash_register_id: registerId,
          opened_by: userId,
          opening_amount: amount,
          expected_amount: amount,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      localStorage.setItem(LS_LOC, locationId);
      localStorage.setItem(LS_REG, registerId);
      toast.success("Caja abierta");
      onOpened(data);
    } catch (e) {
      toast.error(errorToMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // ===== Empty state: faltan sedes o cajas =====
  if (!locations.length || !registers.length) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-4 bg-muted/30">
        <div className="w-full max-w-md bg-card rounded-2xl border p-6 space-y-5 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 grid place-items-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Falta configuración</h1>
            <p className="text-sm text-muted-foreground">
              {!locations.length
                ? "No hay sedes activas en tu organización."
                : "No hay cajas registradas para esta sede."}
            </p>
          </div>
          <Button className="w-full h-11" onClick={() => navigate("/admin")}>
            <Settings className="w-4 h-4 mr-2" /> Configurar sede / caja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center p-4 bg-muted/30">
      <form
        onSubmit={(e) => { e.preventDefault(); open(); }}
        className="w-full max-w-md bg-card rounded-2xl border p-6 space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 grid place-items-center">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Abrir caja</h1>
          <p className="text-sm text-muted-foreground">Inicia tu turno de venta</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pos-location">Sede</Label>
          <select
            id="pos-location"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pos-register">Caja</Label>
          <select
            id="pos-register"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={registerId}
            onChange={(e) => setRegisterId(e.target.value)}
          >
            {filteredRegs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pos-opening" className="flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Base de caja (COP)
          </Label>
          <Input
            id="pos-opening"
            type="number"
            inputMode="numeric"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_BASES.map((v) => {
              const active = Number(opening) === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOpening(String(v))}
                  aria-pressed={active}
                  className={`px-3 h-8 rounded-md border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-accent/20 border-border"
                  }`}
                >
                  {COP_COMPACT(v)}
                </button>
              );
            })}
          </div>
        </div>

        <Button type="submit" className="w-full h-11" disabled={busy}>
          {busy ? "Abriendo..." : "Abrir caja"}
        </Button>
      </form>
    </div>
  );
}
