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
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import MemberLocationsPopover from "./MemberLocationsPopover";
import ResetPasswordButton from "./ResetPasswordButton";
import SetPasswordButton from "./SetPasswordButton";
import CreateMemberDialog from "./CreateMemberDialog";
import MemberAccessActions from "./MemberAccessActions";
import { listTenantMembers, type OrgRole } from "../services/tenantAccess";



export default function MembersAuditTab() {
  const { currentOrg } = useOrganization();
  const { role: currentRole } = useAuth();
  const canSee = currentRole === "superadmin" || currentRole === "admin";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["members-audit", currentOrg?.id],
    enabled: !!currentOrg?.id && canSee,
    queryFn: async () => {
      const result = await listTenantMembers(currentOrg.id);
      return result.members;
    },
  });

  const [locOverrides, setLocOverrides] = useState<Record<string, string[]>>({});
  useEffect(() => { setLocOverrides({}); }, [currentOrg?.id]);
  const canEditLocations = currentRole === "superadmin" || currentRole === "admin";
  const canManageCredentials = currentRole === "superadmin" || currentRole === "admin";


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
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando miembros">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="grid gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
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
          <h2 className="text-lg font-heading font-bold">Usuarios POS</h2>
          <p className="text-[11px] text-muted-foreground">
            Tenant: <strong>{currentOrg.name}</strong> · {active.length} activos · {owners.length} owner(s)
          </p>
        </div>
        <CreateMemberDialog
          organizationId={currentOrg.id}
          organizationName={currentOrg.name}
          canAssignOwner={currentRole === "superadmin"}
          disabled={!canManageCredentials}
          onCreated={() => refetch()}
        />
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
        <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-[10px] uppercase font-semibold text-muted-foreground">
          <div className="col-span-3">Usuario</div>
          <div className="col-span-2">Rol y acceso</div>
          <div className="col-span-3">Sucursales</div>
          <div className="col-span-1">Activo</div>
          <div className="col-span-1">Alta</div>
          <div className="col-span-2 text-right">Credenciales</div>
        </div>
        {members.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No hay miembros registrados.</p>
        ) : members.map((m: any) => {
          const effectiveLocs = locOverrides[m.id] ?? m.location_ids ?? [];
          return (
             <article key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-2 p-4 md:px-3 md:py-2.5 border-t border-border text-sm items-center">
               <div className="md:col-span-3 min-w-0">
                <p className="font-medium truncate">{m.profile?.full_name || m.profile?.business_name || "—"}</p>
                 <p className="text-[11px] text-muted-foreground truncate">{m.email || m.user_id}</p>
              </div>
               <div className="md:col-span-2">
                 <MemberAccessActions organizationId={currentOrg.id} userId={m.user_id} role={m.role as OrgRole} active={m.is_active} canAssignOwner={currentRole === "superadmin"} onChanged={() => void refetch()} />
              </div>
               <div className="md:col-span-3">
                 <span className="md:hidden text-[10px] uppercase text-muted-foreground">Sucursales</span>
                <MemberLocationsPopover
                  memberId={m.id}
                  role={m.role}
                  value={effectiveLocs}
                  disabled={!canEditLocations}
                  onChange={(next) => setLocOverrides((prev) => ({ ...prev, [m.id]: next }))}
                />
              </div>
               <div className="md:col-span-1">
                {m.is_active
                  ? <span className="text-[11px] text-success font-medium">Activo</span>
                  : <span className="text-[11px] text-muted-foreground">Inactivo</span>}
              </div>
               <div className="md:col-span-1 text-[11px] text-muted-foreground">
                {m.created_at ? new Date(m.created_at).toLocaleDateString("es-CO") : "—"}
              </div>
               <div className="md:col-span-2 flex md:justify-end gap-1.5 flex-wrap border-t md:border-0 border-border pt-3 md:pt-0">
                <SetPasswordButton
                  organizationId={currentOrg.id}
                  targetUserId={m.user_id}
                  memberLabel={m.profile?.full_name || m.profile?.business_name || m.user_id}
                  disabled={!canManageCredentials || !m.is_active}
                />
                <ResetPasswordButton
                  targetUserId={m.user_id}
                  organizationId={currentOrg.id}
                  memberLabel={m.profile?.full_name || m.profile?.business_name || m.user_id}
                  disabled={!canManageCredentials || !m.is_active}
                />
             </article>
          );
        })}
      </div>

    </div>
  );
}
