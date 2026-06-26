import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CalendarDays, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";


interface ServiceRow { id: string; name: string; duration_minutes: number; price: number; category: string | null; is_active: boolean; }
interface ResourceRow { id: string; name: string; kind: string; color: string | null; is_active: boolean; }
interface AppointmentRow {
  id: string; customer_name: string; customer_phone: string | null;
  starts_at: string; ends_at: string; status: string;
  service_id: string | null; resource_id: string | null;
  service_catalog?: { name: string } | null;
  service_resources?: { name: string } | null;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-700 border-blue-300",
  confirmed: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-300",
  completed: "bg-green-500/10 text-green-700 border-green-300",
  cancelled: "bg-red-500/10 text-red-700 border-red-300",
  no_show: "bg-zinc-500/10 text-zinc-700 border-zinc-300",
};

export default function AgendaTab() {
  const { currentOrg } = useOrganization();
  const [tab, setTab] = useState("agenda");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const orgId = currentOrg?.id;

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
    const [a, s, r] = await Promise.all([
      supabase.from("appointments")
        .select("*, service_catalog(name), service_resources(name)")
        .eq("organization_id", orgId)
        .gte("starts_at", today.toISOString())
        .lt("starts_at", in14.toISOString())
        .order("starts_at"),
      supabase.from("service_catalog").select("*").eq("organization_id", orgId).order("sort_order"),
      supabase.from("service_resources").select("*").eq("organization_id", orgId).order("name"),
    ]);
    setAppointments((a.data ?? []) as AppointmentRow[]);
    setServices((s.data ?? []) as ServiceRow[]);
    setResources((r.data ?? []) as ResourceRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  if (!currentOrg) return <div className="p-4 text-sm text-muted-foreground">Selecciona una organización.</div>;

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Agenda
          </h2>
          <p className="text-sm text-muted-foreground">Citas, servicios y recursos de {currentOrg.name}.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="agenda">Citas ({appointments.length})</TabsTrigger>
          <TabsTrigger value="services">Servicios ({services.length})</TabsTrigger>
          <TabsTrigger value="resources">Recursos ({resources.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-3">
          <AppointmentDialog orgId={orgId!} services={services} resources={resources} onSaved={load} />
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="space-y-2">
              {appointments.length === 0 && <p className="text-sm text-muted-foreground">Sin citas próximas (14 días).</p>}
              {appointments.map((a) => (
                <AppointmentCard key={a.id} appt={a} onChanged={load} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-3">
          <ServiceDialog orgId={orgId!} onSaved={load} />
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <div key={s.id} className="rounded-lg border p-3 flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <p className="text-xs text-muted-foreground">{s.duration_minutes} min · ${Number(s.price).toLocaleString("es-CO")} {s.category ? `· ${s.category}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!window.confirm(`¿Eliminar "${s.name}"?`)) return;
                  const { error } = await supabase.from("service_catalog").delete().eq("id", s.id);
                  if (error) toast.error(error.message); else { toast.success("Servicio eliminado"); load(); }
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-3">
          <ResourceDialog orgId={orgId!} onSaved={load} />
          <div className="grid gap-2 sm:grid-cols-2">
            {resources.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {r.color && <span className="inline-block h-3 w-3 rounded-full" style={{ background: r.color }} />}
                    {r.name}
                  </div>
                  <p className="text-xs text-muted-foreground">{r.kind}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!window.confirm(`¿Eliminar "${r.name}"?`)) return;
                  const { error } = await supabase.from("service_resources").delete().eq("id", r.id);
                  if (error) toast.error(error.message); else { toast.success("Recurso eliminado"); load(); }
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentCard({ appt, onChanged }: { appt: AppointmentRow; onChanged: () => void }) {
  const d = new Date(appt.starts_at);
  return (
    <div className="rounded-lg border bg-card p-3 flex justify-between items-start gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">
          {d.toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" })} · {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="font-semibold truncate">{appt.customer_name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {appt.service_catalog?.name ?? "(sin servicio)"} · {appt.service_resources?.name ?? "(sin recurso)"}
        </div>
        {appt.customer_phone && <div className="text-xs text-muted-foreground">📱 {appt.customer_phone}</div>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant="outline" className={statusColors[appt.status] ?? ""}>{appt.status}</Badge>
        <Select
          value={appt.status}
          onValueChange={async (v) => {
            const { error } = await supabase.from("appointments").update({ status: v }).eq("id", appt.id);
            if (error) toast.error(error.message); else { toast.success("Estado actualizado"); onChanged(); }
          }}
        >
          <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(statusColors).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AppointmentDialog({ orgId, services, resources, onSaved }:
  { orgId: string; services: ServiceRow[]; resources: ResourceRow[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [resourceId, setResourceId] = useState<string | undefined>();
  const [startsAt, setStartsAt] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name || !startsAt || !serviceId) { toast.error("Cliente, servicio y fecha son obligatorios"); return; }
    const svc = services.find((s) => s.id === serviceId);
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + (svc?.duration_minutes ?? 60) * 60000);
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      organization_id: orgId,
      customer_name: name, customer_phone: phone || null,
      service_id: serviceId, resource_id: resourceId ?? null,
      starts_at: start.toISOString(), ends_at: end.toISOString(),
      price: svc?.price ?? 0, channel: "admin",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cita creada"); setOpen(false); onSaved();
    setName(""); setPhone(""); setStartsAt(""); setServiceId(undefined); setResourceId(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nueva cita</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva cita</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Cliente</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Teléfono</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Recurso</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>{resources.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Inicio</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({ orgId, onSaved }: { orgId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0); const [category, setCategory] = useState("spa");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("service_catalog").insert({
      organization_id: orgId, name, slug, duration_minutes: duration, price, category,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Servicio creado"); setOpen(false); onSaved(); setName(""); setDuration(60); setPrice(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo servicio</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo servicio</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duración (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
            <div><Label>Precio</Label><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
          </div>
          <div><Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["spa","belleza","unas","masajes","peluqueria","otro"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceDialog({ orgId, onSaved }: { orgId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [kind, setKind] = useState("professional");
  const [color, setColor] = useState("#76B833"); const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    const { error } = await supabase.from("service_resources").insert({
      organization_id: orgId, name, kind, color,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Recurso creado"); setOpen(false); onSaved(); setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo recurso</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo recurso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["professional","room","chair","equipment"].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
