import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Search, Shield, ShieldCheck, ShieldAlert, User, Store, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AppRole = "superadmin" | "admin" | "editor" | "user";
type BusinessType = "detal" | "horeca" | "minimercado" | "distribuidor";

const roleMeta: Record<AppRole, { label: string; color: string; icon: typeof Shield }> = {
  superadmin: { label: "Superadmin", color: "bg-destructive text-destructive-foreground", icon: ShieldAlert },
  admin: { label: "Admin", color: "bg-primary text-primary-foreground", icon: ShieldCheck },
  editor: { label: "Editor", color: "bg-accent text-accent-foreground", icon: Shield },
  user: { label: "Cliente", color: "bg-muted text-muted-foreground", icon: User },
};

const businessMeta: Record<BusinessType, { label: string; color: string }> = {
  detal: { label: "Detal", color: "bg-accent text-accent-foreground" },
  horeca: { label: "HORECA", color: "bg-primary text-primary-foreground" },
  minimercado: { label: "Minimercado", color: "bg-secondary text-secondary-foreground" },
  distribuidor: { label: "Distribuidor", color: "bg-secondary text-secondary-foreground" },
};

const UsersTab = ({ queryClient }: { queryClient: any }) => {
  const { user: currentUser, role: currentRole } = useAuth();
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    field: "role" | "business_type";
    value: string;
  }>({ open: false, userId: "", userName: "", field: "role", value: "" });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      if (rolesError) throw rolesError;

      return profiles.map((p: any) => ({
        ...p,
        role: (roles?.find((r: any) => r.user_id === p.user_id)?.role || "user") as AppRole,
        role_id: roles?.find((r: any) => r.user_id === p.user_id)?.id,
      }));
    },
  });

  const handleConfirm = async () => {
    const { userId, field, value } = confirmDialog;
    if (field === "role") {
      const userRecord = users?.find((u: any) => u.user_id === userId);
      if (userRecord?.role_id) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: value as AppRole })
          .eq("id", userRecord.role_id);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: value as AppRole }]);
        if (error) { toast.error(error.message); return; }
      }
      toast.success(`Rol actualizado a ${roleMeta[value as AppRole]?.label || value}`);
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({ business_type: value as BusinessType })
        .eq("user_id", userId);
      if (error) { toast.error(error.message); return; }
      toast.success(`Tipología actualizada a ${businessMeta[value as BusinessType]?.label || value}`);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setConfirmDialog({ open: false, userId: "", userName: "", field: "role", value: "" });
  };

  const requestChange = (userId: string, userName: string, field: "role" | "business_type", value: string) => {
    // Prevent non-superadmin from assigning superadmin/admin
    if (field === "role" && (value === "superadmin" || value === "admin") && currentRole !== "superadmin") {
      toast.error("Solo el Superadmin puede asignar este rol");
      return;
    }
    // Prevent changing own role
    if (userId === currentUser?.id) {
      toast.error("No puedes cambiar tu propio rol");
      return;
    }
    setConfirmDialog({ open: true, userId, userName, field, value });
  };

  const filtered = users?.filter((u: any) => {
    const q = search.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.business_name || "").toLowerCase().includes(q) ||
      (u.phone || "").includes(q)
    );
  });

  const isSuperadmin = currentRole === "superadmin";
  const availableRoles: AppRole[] = isSuperadmin
    ? ["user", "editor", "admin", "superadmin"]
    : ["user", "editor"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Usuarios ({users?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">Gestión de roles y tipologías de precio</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, NIT o teléfono..."
          className="w-full bg-muted rounded-lg pl-9 pr-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered?.map((u: any) => {
          const rm = roleMeta[u.role as AppRole] || roleMeta.user;
          const bm = businessMeta[u.business_type as BusinessType] || businessMeta.detal;
          const RoleIcon = rm.icon;
          const isCurrentUser = u.user_id === currentUser?.id;
          const isSuperadminUser = u.role === "superadmin";

          return (
            <div key={u.id} className="bg-card rounded-lg p-4 border border-border space-y-3">
              {/* User info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <RoleIcon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-semibold text-foreground">
                      {u.full_name || "Sin nombre"}
                      {isCurrentUser && <span className="text-[10px] text-muted-foreground ml-1">(Tú)</span>}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {u.phone && <span className="text-[11px] text-muted-foreground">{u.phone}</span>}
                      {u.business_name && <span className="text-[11px] text-muted-foreground">· {u.business_name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading font-bold ${rm.color}`}>
                    {rm.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading font-bold ${bm.color}`}>
                    {bm.label}
                  </span>
                </div>
              </div>

              {/* Actions - disabled for superadmin users (can't change) or for editors viewing */}
              {!isSuperadminUser && !isCurrentUser && (
                <div className="flex gap-2">
                  {/* Role selector */}
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground mb-0.5 block font-medium">Rol</label>
                    <select
                      value={u.role}
                      onChange={(e) => requestChange(u.user_id, u.full_name || "Usuario", "role", e.target.value)}
                      className="w-full bg-muted rounded-lg px-3 py-2 text-sm font-medium border border-transparent focus:border-primary focus:outline-none transition-colors"
                    >
                      {availableRoles.map((r) => (
                        <option key={r} value={r}>{roleMeta[r].label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Business type selector */}
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground mb-0.5 block font-medium">Tipología</label>
                    <select
                      value={u.business_type || "detal"}
                      onChange={(e) => requestChange(u.user_id, u.full_name || "Usuario", "business_type", e.target.value)}
                      className="w-full bg-muted rounded-lg px-3 py-2 text-sm font-medium border border-transparent focus:border-primary focus:outline-none transition-colors"
                    >
                      {Object.entries(businessMeta).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Info row */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{u.city || "Sin ciudad"}</span>
                {u.address && <span>· {u.address}</span>}
                <span className="ml-auto">
                  {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered?.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No se encontraron usuarios</p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirmar cambio</DialogTitle>
            <DialogDescription>
              {confirmDialog.field === "role"
                ? `¿Estás seguro de asignar el rol "${roleMeta[confirmDialog.value as AppRole]?.label}" a ${confirmDialog.userName}?`
                : `¿Estás seguro de asignar precios de ${businessMeta[confirmDialog.value as BusinessType]?.label} a ${confirmDialog.userName}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleConfirm} size="sm" className="bg-secondary hover:bg-secondary/90">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersTab;
