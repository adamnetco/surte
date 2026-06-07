import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Banknote, Store } from "lucide-react";

interface Props {
  organizationId: string;
  locations: { id: string; name: string }[];
  registers: { id: string; name: string; location_id: string }[];
  userId: string;
  onOpened: (s: any) => void;
}

export default function OpenSessionPanel({ organizationId, locations, registers, userId, onOpened }: Props) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const filteredRegs = registers.filter((r) => r.location_id === locationId);
  const [registerId, setRegisterId] = useState(filteredRegs[0]?.id ?? "");
  const [opening, setOpening] = useState("0");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const first = registers.find((r) => r.location_id === locationId);
    setRegisterId(first?.id ?? "");
  }, [locationId, registers]);

  const open = async () => {
    if (!locationId || !registerId) return toast.error("Selecciona sede y caja");
    setBusy(true);
    const amount = Number(opening) || 0;
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
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Caja abierta");
    onOpened(data);
  };

  return (
    <div className="min-h-[100dvh] grid place-items-center p-4 bg-muted/30">
      <div className="w-full max-w-md bg-card rounded-2xl border p-6 space-y-5">
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
          <Label htmlFor="pos-opening" className="flex items-center gap-2"><Banknote className="w-4 h-4" /> Base de caja (COP)</Label>
          <Input
            id="pos-opening"
            type="number"
            inputMode="numeric"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0"
          />
        </div>

        <Button className="w-full h-11" onClick={open} disabled={busy}>
          {busy ? "Abriendo..." : "Abrir caja"}
        </Button>
      </div>
    </div>
  );
}
