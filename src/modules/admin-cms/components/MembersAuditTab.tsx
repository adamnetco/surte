/**
 * MembersAuditTab — panel de auditoría de organization_members.
 *
 * Muestra para el tenant actual:
 *  - Quién es owner (debería ser 1)
 *  - Miembros activos por rol
 *  - Mensajes claros cuando la org está vacía (sin owner) o cuando el usuario
 *    actual no tiene permisos para gestionar miembros.
 *
 * No hace mutaciones — es de solo lectura, pensado para SuperAdmin/Admin para
 * detectar regresiones de RLS o tenants huérfanos.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { Shield, ShieldAlert, ShieldCheck, User, Crown, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const roleBadge: Record<string, { label: string; cls: string; Icon: typeof Shield }> = {
  owner:   { label: "Owner (Dueño)", cls: "bg-primary/15 text-primary",            Icon: Crown },
  admin:   { label: "Admin",          cls: "bg-accent/15 text-accent",              Icon: ShieldCheck },
  manager: { label: "Manager",        cls: "bg-secondary/30 text-secondary-foreground", Icon: Shield },
  cashier: { label: "Cajero",         cls: "bg-muted text-foreground",              Icon: User },
  waiter:  { label: "Mesero",         cls: "bg-muted text-foreground",              Icon: User },
  kitchen: { label: "Cocina",         cls: "bg-muted text-foreground",              Icon: User },
  agent:   { label: "Agente",         cls: "bg-muted text-foreground",              Icon: User },
  member:  { label: "Miembro",        cls: "bg-muted/60 text-muted-foreground",     Icon: User },
};

export default function MembersAuditTab() {
  const { currentOrg } = useOrganization();
  const { role: currentRole } = useAuth();
  const canSee = currentRole === "superadmin" || currentRole === "admin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["members-audit", currentOrg?.id],
    enabled: !!currentOrg?.id && canSee,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("organization_members")
        .select("id, user_id, role, is_active, created_at")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Best-effort profile lookup (puede fallar por RLS para algunos roles)
      const userIds = (members ?? []).map((m: any) => m.user_id);
      let profilesById: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, full_name, business_name")
          .in("user_id", userIds);
        for (const p of profiles ?? []) profilesById[(p as any).user_id] = p;
      }
      return (members ?? []).map((m: any) => ({ ...m, profile: profilesById[m.user_id] ?? null }));
    },
  });

  if (!canSee) {
    return (
      <div className="p-6 rounded-lg border border-warning/30 bg-warning/5 text-sm flex gap-3">
        <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Sin permiso</p>
          <p className="text-muted-foreground">
            Tu rol actual (<strong>{currentRole}</strong>) no permite ver la auditoría de miembros.
            Necesitas rol <code>admin</code> o <code>superadmin</code>.
          </p>
        </div>
      </div>
    );
  }
  if (!currentOrg) return <p className="text-sm text-muted-foreground p-4">Selecciona una organización.</p>;
  if (isLoading) return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando miembros…</div>;
  if (error) return <p className="text-sm text-destructive p-4">Error: {(error as Error).message}</p>;

  const members = data ?? [];
  const active = members.filter((m: any) => m.is_active);
  const owners = active.filter((m: any) => m.role === "owner");
  const isEmpty = active.length === 0;
  const hasNoOwner = !isEmpty && owners.length === 0;
  const tooManyOwners = owners.length > 1;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold">Auditoría de miembros</h2>
          <p className="text-[11px] text-muted-foreground">
            Tenant: <strong>{currentOrg.name}</strong> · {active.length} activos · {owners.length} owner(s)
          </p>
        </div>
      </header>

      {/* Estados críticos */}
      {isEmpty && (
        <div className="p-4 rounded-lg border-2 border-destructive/40 bg-destructive/5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Organización vacía</p>
            <p className="text-muted-foreground">
              Esta organización no tiene ningún miembro activo. Nadie podrá gestionarla.
              Crea un usuario con rol <strong>Admin</strong> y asígnalo como <code>owner</code>.
            </p>
          </div>
        </div>
      )}
      {hasNoOwner && (
        <div className="p-4 rounded-lg border-2 border-warning/50 bg-warning/5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Sin owner</p>
            <p className="text-muted-foreground">
              Hay miembros activos pero ninguno es <code>owner</code>. Asigna uno para que pueda
              modificar la configuración de la tienda.
            </p>
          </div>
        </div>
      )}
      {tooManyOwners && (
        <div className="p-4 rounded-lg border border-accent/40 bg-accent/5 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Más de un owner ({owners.length})</p>
            <p className="text-muted-foreground">
              Recomendado: dejar un único <code>owner</code> y degradar el resto a <code>admin</code>.
            </p>
          </div>
        </div>
      )}
      {!isEmpty && !hasNoOwner && !tooManyOwners && (
        <div className="p-3 rounded-lg border border-success/30 bg-success/5 flex gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <span>Estructura saludable: 1 owner y {active.length - 1} miembro(s) adicional(es).</span>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-[10px] uppercase font-semibold text-muted-foreground">
          <div className="col-span-5">Usuario</div>
          <div className="col-span-3">Rol</div>
          <div className="col-span-2">Activo</div>
          <div className="col-span-2">Alta</div>
        </div>
        {members.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No hay miembros registrados.</p>
        ) : members.map((m: any) => {
          const meta = roleBadge[m.role] ?? roleBadge.member;
          const Icon = meta.Icon;
          return (
            <div key={m.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-border text-sm items-center">
              <div className="col-span-5 min-w-0">
                <p className="font-medium truncate">{m.profile?.full_name || m.profile?.business_name || "—"}</p>
                <p className="text-[10px] text-muted-foreground truncate font-mono">{m.user_id}</p>
              </div>
              <div className="col-span-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.cls}`}>
                  <Icon size={11} /> {meta.label}
                </span>
              </div>
              <div className="col-span-2">
                {m.is_active
                  ? <span className="text-[11px] text-success font-medium">Activo</span>
                  : <span className="text-[11px] text-muted-foreground">Inactivo</span>}
              </div>
              <div className="col-span-2 text-[11px] text-muted-foreground">
                {m.created_at ? new Date(m.created_at).toLocaleDateString("es-CO") : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
