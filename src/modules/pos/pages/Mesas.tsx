import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { LockKeyhole, Users } from "lucide-react";
import { toast } from "sonner";
import TableOrderDrawer from "@/modules/pos/components/TableOrderDrawer";
import POSWorkspaceNav from "@/modules/pos/components/POSWorkspaceNav";
import { useTablesFloor, type FloorTable } from "@/modules/pos/hooks/useTablesFloor";

const STATUS_BG: Record<string, string> = {
  available: "bg-secondary/15 border-secondary/40 text-secondary-foreground",
  occupied:  "bg-accent/20 border-accent text-foreground",
  reserved:  "bg-primary/15 border-primary text-primary",
  dirty:     "bg-muted border-muted-foreground/30 text-muted-foreground",
};

export default function Mesas() {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, hasModule, loading: orgLoading } = useOrganization();
  const navigate = useNavigate();

  const orgId = currentOrg?.id;
  const { areas, tables, ordersByTable, loading, reload } = useTablesFloor(orgId, { withCoords: true });

  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [user, authLoading, navigate]);
  useEffect(() => { document.title = `Mesas · ${currentOrg?.name ?? "Mi Negocio"}`; }, [currentOrg?.name]);
  // Auto-seleccionar la primera zona en cuanto cargan
  useEffect(() => {
    if (!activeArea && areas.length) setActiveArea(areas[0].id);
  }, [areas, activeArea]);

  const filtered = useMemo(
    () => activeArea ? tables.filter(t => t.dining_area_id === activeArea) : tables,
    [tables, activeArea]
  );

  if (authLoading || orgLoading || loading) {
    return (
      <div className="min-h-[100dvh] p-4" aria-busy="true" aria-live="polite">
        <div className="h-8 w-40 rounded-md bg-muted animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!currentOrg) return <div className="min-h-[100dvh] grid place-items-center text-muted-foreground">Sin organización</div>;
  if (!hasModule("tables")) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <LockKeyhole className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Módulo Mesas no activo</h1>
          <p className="text-sm text-muted-foreground">Activa <code className="bg-muted px-1 rounded">tables</code> para tu organización.</p>
        </div>
      </div>
    );
  }

  const openTable = async (t: FloorTable) => {
    const existing = ordersByTable.get(t.id);
    if (existing && existing.length) { setOpenTableId(t.id); return; }
    // create open order
    const { data, error } = await supabase.from("table_orders").insert({
      organization_id: orgId,
      location_id: (await supabase.from("dining_tables").select("location_id").eq("id", t.id).single()).data?.location_id,
      dining_table_id: t.id,
      service_type_key: "dine_in",
      waiter_id: user!.id,
      status: "open",
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("dining_tables").update({ status: "occupied" }).eq("id", t.id).eq("organization_id", orgId!);
    setOpenTableId(t.id);
  };

  return (
    <div className="min-h-[100dvh] bg-muted/30 flex flex-col">
      <div className="bg-card border-b px-3 py-2 flex items-center gap-2 overflow-x-auto">
        <h1 className="font-semibold mr-2">Mesas</h1>
        <POSWorkspaceNav className="mr-2" />
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {areas.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveArea(a.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${activeArea === a.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-auto p-4">
        <div className="relative w-full min-h-[500px] bg-card rounded-xl border-2 border-dashed border-border">
          {filtered.length === 0 && (
            <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Sin mesas en esta zona</p>
          )}
          {filtered.map(t => {
            const tableOrders = ordersByTable.get(t.id) ?? [];
            const totalAll = tableOrders.reduce((s, o) => s + Number(o.total), 0);
            const status = tableOrders.length > 0 ? "occupied" : t.status;
            const splits = tableOrders.length > 1 ? tableOrders.map((o) => o.sub_label ?? "·") : null;
            return (
              <button
                key={t.id}
                onClick={() => openTable(t)}
                className={`absolute rounded-xl border-2 p-2 flex flex-col items-center justify-center transition hover:scale-105 active:scale-95 ${STATUS_BG[status] ?? STATUS_BG.available} ${t.shape === "round" ? "rounded-full" : ""}`}
                style={{ left: t.pos_x, top: t.pos_y, width: t.width, height: t.height }}
              >
                <span className="font-bold text-sm flex items-baseline gap-0.5">
                  {t.label}
                  {splits && (
                    <span className="text-[9px] font-mono opacity-70">
                      {splits.join("/")}
                    </span>
                  )}
                </span>
                <span className="text-[10px] flex items-center gap-0.5 opacity-70">
                  <Users className="w-3 h-3" />{t.capacity}
                </span>
                {tableOrders.length > 0 && (
                  <span className="text-[10px] font-semibold mt-0.5">
                    ${Math.round(totalAll).toLocaleString("es-CO")}
                    {tableOrders.length > 1 && <span className="ml-1 opacity-70">({tableOrders.length})</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-3 text-xs flex-wrap">
          <Legend color="bg-secondary/30" label="Libre" />
          <Legend color="bg-accent/30" label="Ocupada" />
          <Legend color="bg-primary/20" label="Reservada" />
          <Legend color="bg-muted" label="Por limpiar" />
        </div>
      </div>

      {openTableId && (
        <TableOrderDrawer
          tableId={openTableId}
          organizationId={orgId!}
          userId={user!.id}
          onClose={() => { setOpenTableId(null); reload(); }}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded border ${color}`} />{label}</div>;
}
