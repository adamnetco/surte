import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Loader2, LockKeyhole, ChefHat, Check, Play, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import POSWorkspaceNav from "@/modules/pos/components/POSWorkspaceNav";

interface Station { id: string; name: string; color: string | null; }
interface Ticket {
  id: string; kitchen_station_id: string | null; dining_table_label: string | null;
  items: any[]; status: string; sent_at: string; started_at: string | null; ready_at: string | null;
  notes: string | null;
}

const elapsedMin = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

const STATUS_STYLES: Record<string, string> = {
  pending: "border-accent bg-accent/10",
  in_progress: "border-primary bg-primary/10",
  ready: "border-secondary bg-secondary/15",
};

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
  useEffect(() => { document.title = "KDS · SurteYa"; }, []);

  // Re-render every 30s to update timers
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const orgId = currentOrg?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: st }, { data: tk }] = await Promise.all([
      supabase.from("kitchen_stations").select("id,name,color").eq("organization_id", orgId).eq("is_active", true).order("sort_order"),
      supabase.from("kds_tickets").select("id,kitchen_station_id,dining_table_label,items,status,sent_at,started_at,ready_at,notes")
        .eq("organization_id", orgId).in("status", ["pending","in_progress","ready"]).order("sent_at"),
    ]);
    setStations(st ?? []);
    setTickets((tk as Ticket[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel("kds-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "kds_tickets", filter: `organization_id=eq.${orgId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const filtered = useMemo(
    () => activeStation === "all" ? tickets : tickets.filter(t => t.kitchen_station_id === activeStation),
    [tickets, activeStation]
  );

  const bump = async (t: Ticket) => {
    const next = t.status === "pending" ? "in_progress" : t.status === "in_progress" ? "ready" : "served";
    const patch: any = { status: next, bumped_by: user!.id };
    if (next === "in_progress") patch.started_at = new Date().toISOString();
    if (next === "ready") patch.ready_at = new Date().toISOString();
    if (next === "served") patch.served_at = new Date().toISOString();
    const { error } = await supabase.from("kds_tickets").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
  };

  if (authLoading || orgLoading || loading) {
    return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
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
        <h1 className="font-semibold mr-3">KDS</h1>
        <button onClick={() => setActiveStation("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${activeStation === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
          Todas
        </button>
        {stations.map(s => (
          <button key={s.id} onClick={() => setActiveStation(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${activeStation === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
            {s.name}
          </button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => navigate("/mesas")}>← Mesas</Button>
      </div>

      <div className="flex-1 p-3 overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-background/60 py-12">Sin comandas pendientes</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(t => {
              const mins = elapsedMin(t.sent_at);
              const urgent = mins >= 10;
              return (
                <div key={t.id}
                  className={`rounded-lg border-2 p-3 text-foreground ${STATUS_STYLES[t.status] ?? "bg-card"} ${urgent && t.status !== "ready" ? "animate-pulse" : ""}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">{t.dining_table_label ?? "Para llevar"}</span>
                    <span className={`text-xs font-mono ${urgent ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                      {mins}min
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm mb-3">
                    {(t.items ?? []).map((i: any, idx: number) => (
                      <li key={idx} className="flex justify-between">
                        <span>{i.name}</span>
                        <span className="font-semibold ml-2">×{i.qty}</span>
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
