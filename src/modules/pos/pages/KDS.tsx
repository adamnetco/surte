import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Loader2, LockKeyhole, ChefHat, Check, Play, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import POSWorkspaceNav from "@/modules/pos/components/POSWorkspaceNav";

interface Station { id: string; name: string; color: string | null; sla_minutes: number; }
interface KdsItem { name: string; qty: number; done?: boolean }
interface Ticket {
  id: string; kitchen_station_id: string | null; dining_table_label: string | null;
  items: KdsItem[]; status: string; sent_at: string; started_at: string | null; ready_at: string | null;
  notes: string | null;
}

const elapsedSec = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
const fmtMMSS = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

// Semáforo color-por-tiempo según SLA de la estación
function timeTone(elapsedS: number, slaMin: number, status: string) {
  if (status === "ready") return { card: "border-emerald-500 bg-emerald-500/10", timer: "text-emerald-600" };
  const slaSec = Math.max(60, slaMin * 60);
  const ratio = elapsedS / slaSec;
  if (ratio < 0.5) return { card: "border-emerald-500 bg-emerald-500/5", timer: "text-emerald-600" };
  if (ratio < 1)   return { card: "border-amber-500 bg-amber-500/10",   timer: "text-amber-600" };
  return { card: "border-destructive bg-destructive/10 animate-pulse", timer: "text-destructive font-bold" };
}

export default function KDS() {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, hasModule, loading: orgLoading } = useOrganization();
  const navigate = useNavigate();

  const [stations, setStations] = useState<Station[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeStation, setActiveStation] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [, force] = useState(0);

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);
  useEffect(() => { document.title = `KDS · ${currentOrg?.name ?? "Mi Negocio"}`; }, [currentOrg?.name]);

  // Tick cada 1s para mm:ss en vivo
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const orgId = currentOrg?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: st }, { data: tk }] = await Promise.all([
      supabase.from("kitchen_stations").select("id,name,color,sla_minutes").eq("organization_id", orgId).eq("is_active", true).order("sort_order"),
      supabase.from("kds_tickets").select("id,kitchen_station_id,dining_table_label,items,status,sent_at,started_at,ready_at,notes")
        .eq("organization_id", orgId).in("status", ["pending","in_progress","ready"]).order("sent_at"),
    ]);
    setStations((st as Station[]) ?? []);
    setTickets((tk as unknown as Ticket[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!orgId) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(uniqueTopic(`kds-${orgId}`))
        .on("postgres_changes", { event: "*", schema: "public", table: "kds_tickets", filter: `organization_id=eq.${orgId}` },
          () => load())
        .subscribe();
    } catch (err) {
      console.warn("[KDS] realtime subscribe failed", err);
    }
    return () => { safeRemoveChannel(ch); };
  }, [orgId, load]);

  const stationById = useMemo(() => {
    const map = new Map<string, Station>();
    stations.forEach(s => map.set(s.id, s));
    return map;
  }, [stations]);

  const filtered = useMemo(
    () => activeStation === "all" ? tickets : tickets.filter(t => t.kitchen_station_id === activeStation),
    [tickets, activeStation]
  );

  const bump = async (t: Ticket) => {
    const next = t.status === "pending" ? "in_progress" : t.status === "in_progress" ? "ready" : "served";
    const patch: Record<string, unknown> = { status: next, bumped_by: user!.id };
    if (next === "in_progress") patch.started_at = new Date().toISOString();
    if (next === "ready") patch.ready_at = new Date().toISOString();
    if (next === "served") patch.served_at = new Date().toISOString();
    const { error } = await supabase.from("kds_tickets").update(patch).eq("id", t.id).eq("organization_id", orgId!);
    if (error) return toast.error(error.message);
  };

  const toggleItem = async (ticketId: string, idx: number, done: boolean) => {
    // optimista
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const items = [...t.items];
      items[idx] = { ...items[idx], done };
      return { ...t, items };
    }));
    const { error } = await supabase.rpc("kds_toggle_item", {
      p_ticket_id: ticketId, p_item_index: idx, p_done: done,
    });
    if (error) { toast.error(error.message); load(); }
  };

  if (authLoading || orgLoading || loading) {
    return (
      <div className="min-h-[100dvh] p-4" aria-busy="true" aria-live="polite">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!currentOrg) return <div className="min-h-[100dvh] grid place-items-center text-muted-foreground">Sin organización</div>;
  if (!hasModule("kds")) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <LockKeyhole className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Módulo KDS no activo</h1>
          <p className="text-sm text-muted-foreground">Activa <code className="bg-muted px-1 rounded">kds</code> para tu organización.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-foreground/95 text-background flex flex-col">
      <div className="bg-card text-card-foreground border-b px-3 py-2 flex items-center gap-2 overflow-x-auto">
        <ChefHat className="w-5 h-5 text-primary" />
        <h1 className="font-semibold mr-2">KDS</h1>
        <POSWorkspaceNav className="mr-2" />
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          <button onClick={() => setActiveStation("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${activeStation === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
            Todas
          </button>
          {stations.map(s => (
            <button key={s.id} onClick={() => setActiveStation(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${activeStation === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
              {s.name} <span className="opacity-60">· SLA {s.sla_minutes}m</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-background/60 py-12">Sin comandas pendientes</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(t => {
              const station = t.kitchen_station_id ? stationById.get(t.kitchen_station_id) : undefined;
              const sla = station?.sla_minutes ?? 10;
              const secs = elapsedSec(t.sent_at);
              const tone = timeTone(secs, sla, t.status);
              const items = t.items ?? [];
              const doneCount = items.filter(i => i.done).length;
              return (
                <div key={t.id} className={`rounded-lg border-2 p-3 text-foreground bg-card ${tone.card}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold">{t.dining_table_label ?? "Para llevar"}</span>
                    <span className={`text-xs font-mono ${tone.timer}`}>{fmtMMSS(secs)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2 text-[11px] text-muted-foreground">
                    <span>{station?.name ?? "—"}</span>
                    <span>{doneCount}/{items.length}</span>
                  </div>
                  <ul className="space-y-1 text-sm mb-3">
                    {items.map((i, idx) => (
                      <li key={idx}>
                        <button
                          onClick={() => toggleItem(t.id, idx, !i.done)}
                          className={`w-full flex justify-between items-center gap-2 px-2 py-1 rounded hover:bg-muted/60 transition ${i.done ? "opacity-50 line-through" : ""}`}
                          aria-pressed={!!i.done}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`inline-flex w-4 h-4 items-center justify-center rounded border ${i.done ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                              {i.done && <Check className="w-3 h-3" />}
                            </span>
                            {i.name}
                          </span>
                          <span className="font-semibold ml-2">×{i.qty}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {t.notes && <p className="text-xs italic text-muted-foreground mb-2">"{t.notes}"</p>}
                  <Button size="sm" onClick={() => bump(t)} className="w-full h-9">
                    {t.status === "pending" && <><Play className="w-3.5 h-3.5 mr-1" /> Iniciar</>}
                    {t.status === "in_progress" && <><BellRing className="w-3.5 h-3.5 mr-1" /> Listo</>}
                    {t.status === "ready" && <><Check className="w-3.5 h-3.5 mr-1" /> Servido</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
