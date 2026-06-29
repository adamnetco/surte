// Ola 28 Slice 1 — Página de reservas: agenda del día + crear reserva con chequeo de disponibilidad.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Plus, Loader2, Check, X, UserCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ReservationsFloorMap from "../components/ReservationsFloorMap";
import {
  useReservationsAgenda,
  useCheckAvailability,
  useCreateReservation,
  useUpdateReservationStatus,
  type ReservationStatus,
  type AvailableTable,
} from "../hooks/useReservations";


const STATUS_COLOR: Record<ReservationStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  confirmed: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  seated: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/30",
  no_show: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};
const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  seated: "Sentada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No show",
};

export default function ReservasPage() {
  useEffect(() => { document.title = "Reservas · SistecPOS"; }, []);
  const [day, setDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const { data: rows, isLoading } = useReservationsAgenda(day);
  const updateStatus = useUpdateReservationStatus();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agenda del día con chequeo automático de disponibilidad por mesa.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="day" className="text-xs flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Fecha
            </Label>
            <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
          </div>
          <NewReservationSheet defaultDay={day} />
        </div>
      </header>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="plano">Plano</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : !rows || rows.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Sin reservas para {format(new Date(day + "T00:00"), "PPP")}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <Card key={r.id} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="text-center w-20">
                    <div className="text-2xl font-bold tabular-nums">{format(new Date(r.starts_at), "HH:mm")}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(r.ends_at), "HH:mm")}</div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">{r.customer_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {r.party_size} pers · Mesa {r.table_label ?? "—"} · {r.source}
                    </div>
                  </div>
                  <Badge variant="outline" className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  {r.deposit_amount > 0 && (
                    <Badge variant="outline" className="gap-1">
                      Depósito {r.deposit_status === "paid" ? "✓" : "⏳"} ${Number(r.deposit_amount).toLocaleString("es-CO")}
                    </Badge>
                  )}
                  <div className="flex gap-1">
                    {r.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "seated" })}>
                        <UserCheck className="h-3.5 w-3.5 mr-1" /> Sentar
                      </Button>
                    )}
                    {r.status === "seated" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Completar
                      </Button>
                    )}
                    {["pending", "confirmed"].includes(r.status) && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: r.id, status: "no_show" })} title="No show">
                          <AlertCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          const reason = window.prompt("Motivo de cancelación") ?? undefined;
                          updateStatus.mutate({ id: r.id, status: "cancelled", cancel_reason: reason });
                        }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plano" className="mt-0">
          <ReservationsFloorMap reservations={rows ?? []} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


function NewReservationSheet({ defaultDay }: { defaultDay: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(defaultDay);
  const [time, setTime] = useState("19:00");
  const [duration, setDuration] = useState(90);
  const [deposit, setDeposit] = useState(0);
  const [tableId, setTableId] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableTable[] | null>(null);
  const check = useCheckAvailability();
  const create = useCreateReservation();

  useEffect(() => { setDate(defaultDay); }, [defaultDay]);

  const startsAt = useMemo(() => new Date(`${date}T${time}:00`).toISOString(), [date, time]);
  const endsAt = useMemo(() => new Date(new Date(startsAt).getTime() + duration * 60_000).toISOString(), [startsAt, duration]);

  const handleCheck = async () => {
    try {
      const res = await check.mutateAsync({ starts_at: startsAt, ends_at: endsAt, party_size: party });
      setAvailable(res);
      if (res.length === 0) toast.warning("No hay mesas disponibles para ese horario.");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al chequear");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      await create.mutateAsync({
        customer_name: name.trim(),
        customer_phone: phone || null,
        party_size: party,
        starts_at: startsAt,
        ends_at: endsAt,
        dining_table_id: tableId,
        deposit_amount: deposit,
        source: "admin",
      });
      toast.success("Reserva creada");
      setOpen(false);
      setName(""); setPhone(""); setParty(2); setTableId(null); setAvailable(null); setDeposit(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Nueva reserva</Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva reserva</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="3001234567" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Personas</Label>
              <Input type="number" min={1} value={party} onChange={(e) => setParty(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duración (min)</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[60, 90, 120, 180].map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Depósito (COP)</Label>
              <Input type="number" min={0} step={1000} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleCheck} disabled={check.isPending}>
            {check.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Buscar mesas disponibles
          </Button>

          {available && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {available.length} mesa(s) disponible(s) para {party} pers
              </Label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {available.map((t) => (
                  <button
                    key={t.dining_table_id}
                    type="button"
                    onClick={() => setTableId(t.dining_table_id)}
                    className={`rounded-md border p-2 text-center transition ${
                      tableId === t.dining_table_id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">cap {t.capacity}</div>
                    {t.area_name && <div className="text-[10px] text-muted-foreground truncate">{t.area_name}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full" onClick={handleSave} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Crear reserva
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
