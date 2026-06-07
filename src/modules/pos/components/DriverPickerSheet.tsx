import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bike, Plus, Trash2, User } from "lucide-react";

export interface DriverInfo {
  name: string;
  phone?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: DriverInfo | null;
  onSelect: (d: DriverInfo | null) => void;
  organizationId: string;
}

const storageKey = (org: string) => `pos_recent_drivers:${org}`;

export default function DriverPickerSheet({ open, onOpenChange, value, onSelect, organizationId }: Props) {
  const [recent, setRecent] = useState<DriverInfo[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(storageKey(organizationId));
      setRecent(raw ? JSON.parse(raw) : []);
    } catch { setRecent([]); }
    setName(""); setPhone("");
  }, [open, organizationId]);

  const persist = (list: DriverInfo[]) => {
    setRecent(list);
    try { localStorage.setItem(storageKey(organizationId), JSON.stringify(list.slice(0, 12))); } catch {}
  };

  const pick = (d: DriverInfo) => {
    const list = [d, ...recent.filter((r) => r.name.toLowerCase() !== d.name.toLowerCase())];
    persist(list);
    onSelect(d);
    onOpenChange(false);
  };

  const addNew = () => {
    const n = name.trim();
    if (!n) return;
    pick({ name: n, phone: phone.trim() || undefined });
  };

  const remove = (n: string) => {
    persist(recent.filter((r) => r.name !== n));
  };

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter((r) => r.name.toLowerCase().includes(q) || (r.phone || "").includes(q));
  }, [name, recent]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Bike className="w-5 h-5 text-primary" /> Asignar domiciliario</SheetTitle>
          <SheetDescription>Selecciona o registra el repartidor para esta entrega.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={addNew} className="w-full" disabled={!name.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Asignar y guardar
          </Button>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Recientes</p>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin domiciliarios guardados todavía.</p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((d) => (
                <li key={d.name} className={`flex items-center gap-2 border rounded-md p-2 ${value?.name === d.name ? "border-primary bg-primary/5" : ""}`}>
                  <User className="w-4 h-4 text-muted-foreground" />
                  <button onClick={() => pick(d)} className="flex-1 text-left">
                    <div className="text-sm font-semibold">{d.name}</div>
                    {d.phone && <div className="text-xs text-muted-foreground">{d.phone}</div>}
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => remove(d.name)} title="Quitar">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {value && (
          <Button variant="outline" className="mt-3" onClick={() => { onSelect(null); onOpenChange(false); }}>
            Quitar domiciliario asignado
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
