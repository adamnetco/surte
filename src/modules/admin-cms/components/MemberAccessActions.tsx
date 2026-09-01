import { useState } from "react";
import { Loader2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  changeTenantMemberRole, deactivateTenantMember, reactivateTenantMember,
  ORG_ROLE_LABELS, type OrgRole,
} from "../services/tenantAccess";

const ROLES: OrgRole[] = ["owner", "admin", "manager", "cashier", "waiter", "kitchen", "agent", "member"];

export default function MemberAccessActions({ organizationId, userId, role, active, canAssignOwner, onChanged }: {
  organizationId: string; userId: string; role: OrgRole; active: boolean; canAssignOwner: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const roles = canAssignOwner ? ROLES : ROLES.filter((item) => item !== "owner");
  const changeRole = async (next: OrgRole) => {
    setBusy(true);
    try { await changeTenantMemberRole({ organizationId, targetUserId: userId, role: next }); toast.success("Rol actualizado"); onChanged(); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };
  const toggle = async () => {
    if (!window.confirm(active ? "¿Desactivar el acceso POS de este usuario?" : "¿Reactivar el acceso POS de este usuario?")) return;
    setBusy(true);
    try {
      if (active) await deactivateTenantMember({ organizationId, targetUserId: userId });
      else await reactivateTenantMember({ organizationId, targetUserId: userId });
      toast.success(active ? "Acceso desactivado" : "Acceso reactivado"); onChanged();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };
  return <div className="flex items-center gap-1.5">
    <Select value={role} onValueChange={(value) => void changeRole(value as OrgRole)} disabled={busy || (role === "owner" && !canAssignOwner)}>
      <SelectTrigger className="h-8 w-32 text-xs" aria-label="Cambiar rol"><SelectValue /></SelectTrigger>
      <SelectContent>{roles.map((item) => <SelectItem key={item} value={item}>{ORG_ROLE_LABELS[item]}</SelectItem>)}</SelectContent>
    </Select>
    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void toggle()} disabled={busy || (role === "owner" && !canAssignOwner)} aria-label={active ? "Desactivar acceso" : "Reactivar acceso"}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
    </Button>
  </div>;
}