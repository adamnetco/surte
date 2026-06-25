import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Search, Shield, ShieldCheck, ShieldAlert, User, Pencil, Save, Briefcase, UserPlus, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AppRole = "superadmin" | "admin" | "editor" | "agente" | "user";
type BusinessType = "detal" | "horeca" | "minimercado" | "distribuidor" | "casa";

const roleMeta: Record<AppRole, { label: string; color: string; icon: typeof Shield }> = {
  superadmin: { label: "Superadmin", color: "bg-destructive text-destructive-foreground", icon: ShieldAlert },
  admin: { label: "Admin", color: "bg-primary text-primary-foreground", icon: ShieldCheck },
  editor: { label: "Editor", color: "bg-accent text-accent-foreground", icon: Shield },
  agente: { label: "Agente", color: "bg-secondary text-secondary-foreground", icon: Briefcase },
  user: { label: "Cliente", color: "bg-muted text-muted-foreground", icon: User },
};

const businessMeta: Record<BusinessType, { label: string; color: string }> = {
  casa: { label: "Casa", color: "bg-muted text-muted-foreground" },
  detal: { label: "Detal", color: "bg-secondary/20 text-secondary-foreground" },
  horeca: { label: "HORECA", color: "bg-primary/20 text-primary" },
  minimercado: { label: "Minimercado", color: "bg-accent/20 text-accent" },
  distribuidor: { label: "Distribuidor", color: "bg-destructive/10 text-destructive" },
};

const UsersTab = ({ queryClient }: { queryClient: any }) => {
  const { user: currentUser, role: currentRole } = useAuth();
  const { currentOrg } = useOrganization();
  const canManageRoles = currentRole === "admin" || currentRole === "superadmin";
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | AppRole>("all");
  const [filterBiz, setFilterBiz] = useState<"all" | BusinessType>("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; userId: string; userName: string; field: "role" | "business_type"; value: string;
  }>({ open: false, userId: "", userName: "", field: "role", value: "" });
  const [editModal, setEditModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", business_name: "", address: "", city: "" });
  const [createModal, setCreateModal] = useState(false);
  // B2B POS: la tipología/lista de precio NO se asigna al crear un usuario interno.
  // Vive en el módulo de Clientes (ContactsTab) y se asigna por cliente con su lista de precios.
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "", phone: "", business_name: "", city: "", role: "user" as AppRole });
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      // Profiles del tenant + miembros activos de la organización
      const { data: profiles, error } = await supabase
        .from("profiles").select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");
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
        const { error } = await supabase.from("user_roles").update({ role: value as AppRole }).eq("id", userRecord.role_id);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: value as AppRole }]);
        if (error) { toast.error(error.message); return; }
      }
      toast.success(`Rol actualizado a ${roleMeta[value as AppRole]?.label || value}`);
    } else {
      const { error } = await supabase.from("profiles").update({ business_type: value as BusinessType }).eq("user_id", userId);
      if (error) { toast.error(error.message); return; }
      toast.success(`Tipología actualizada a ${businessMeta[value as BusinessType]?.label || value}`);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setConfirmDialog({ open: false, userId: "", userName: "", field: "role", value: "" });
  };

  const requestChange = (userId: string, userName: string, field: "role" | "business_type", value: string) => {
    if (field === "role" && value === "superadmin" && currentRole !== "superadmin") {
      toast.error("Solo el Superadmin puede asignar este rol"); return;
    }
    if (userId === currentUser?.id) { toast.error("No puedes cambiar tu propio rol"); return; }
    setConfirmDialog({ open: true, userId, userName, field, value });
  };

  const openEditModal = (u: any) => {
    setEditForm({
      full_name: u.full_name || "", phone: u.phone || "",
      business_name: u.business_name || "", address: u.address || "", city: u.city || "",
    });
    setEditModal({ open: true, user: u });
  };

  const saveEditProfile = async () => {
    if (!editModal.user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name, phone: editForm.phone,
      business_name: editForm.business_name, address: editForm.address, city: editForm.city,
    }).eq("user_id", editModal.user.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil actualizado");
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setEditModal({ open: false, user: null });
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password || !createForm.full_name) {
      toast.error("Email, contraseña y nombre son obligatorios"); return;
    }
    if (createForm.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres"); return;
    }
    setCreating(true);
    try {
      // Sign up the user via Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: createForm.email,
        password: createForm.password,
        options: {
          data: {
            full_name: createForm.full_name,
            phone: createForm.phone || "",
            organization_slug: currentOrg?.slug || undefined,
          },
        },
      });
      if (signUpError) throw signUpError;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("No se pudo crear el usuario");

      // Assign role if not default 'user'
      if (createForm.role !== "user") {
        const { error: roleError } = await supabase.from("user_roles").insert([{ user_id: newUserId, role: createForm.role }]);
        if (roleError) console.warn("Role assignment failed:", roleError.message);
      }

      toast.success(`Usuario ${createForm.full_name} creado exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateModal(false);
      setCreateForm({ email: "", password: "", full_name: "", phone: "", business_name: "", city: "", role: "user" });
    } catch (err: any) {
      toast.error(err.message || "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  };

  const filtered = users?.filter((u: any) => {
    const q = search.toLowerCase();
    const matchesSearch = (u.full_name || "").toLowerCase().includes(q) ||
      (u.business_name || "").toLowerCase().includes(q) || (u.phone || "").includes(q) ||
      (u.customer_code || "").toLowerCase().includes(q);
    const matchesRole = filterRole === "all" || u.role === filterRole;
    const matchesBiz = filterBiz === "all" || u.business_type === filterBiz;
    return matchesSearch && matchesRole && matchesBiz;
  });

  const isSuperadmin = currentRole === "superadmin";
  const isAdminLevel = ["superadmin", "admin"].includes(currentRole);
  const availableRoles: AppRole[] = isSuperadmin
    ? ["user", "editor", "agente", "admin", "superadmin"]
    : isAdminLevel
      ? ["user", "editor", "agente", "admin"]
      : ["user", "editor"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Usuarios ({users?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">Gestión de roles, tipologías y precios</p>
        </div>
        {isAdminLevel && (
          <Button onClick={() => setCreateModal(true)} size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
            <UserPlus size={14} /> Crear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código, NIT o teléfono..."
          className="w-full bg-muted rounded-lg pl-9 pr-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)}
          className="bg-muted rounded-lg px-2.5 py-1.5 text-xs font-medium border border-transparent focus:border-accent focus:outline-none">
          <option value="all">Todos los Roles</option>
          {Object.entries(roleMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterBiz} onChange={(e) => setFilterBiz(e.target.value as any)}
          className="bg-muted rounded-lg px-2.5 py-1.5 text-xs font-medium border border-transparent focus:border-accent focus:outline-none">
          <option value="all">Todas las Tipologías</option>
          {Object.entries(businessMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading && <div className="text-center py-12"><p className="text-sm text-muted-foreground">Cargando usuarios...</p></div>}

      <div className="space-y-2">
        {filtered?.map((u: any) => {
          const rm = roleMeta[u.role as AppRole] || roleMeta.user;
          const bm = businessMeta[u.business_type as BusinessType] || businessMeta.detal;
          const RoleIcon = rm.icon;
          const isCurrentUser = u.user_id === currentUser?.id;
          const isSuperadminUser = u.role === "superadmin";

          return (
            <div key={u.id} className="bg-card rounded-lg p-4 border border-border space-y-3">
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
                      {u.customer_code && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{u.customer_code}</span>}
                      {u.phone && <span className="text-[11px] text-muted-foreground">{u.phone}</span>}
                      {u.business_name && <span className="text-[11px] text-muted-foreground">· {u.business_name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading font-bold ${rm.color}`}>{rm.label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading font-bold ${bm.color}`}>{bm.label}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!isSuperadminUser && !isCurrentUser && canManageRoles && (
                  <>
                    <select value={u.role} onChange={(e) => requestChange(u.user_id, u.full_name || "Usuario", "role", e.target.value)}
                      className="flex-1 bg-muted rounded-lg px-2 py-1.5 text-xs font-medium border border-transparent focus:border-primary focus:outline-none">
                      {availableRoles.map((r) => <option key={r} value={r}>{roleMeta[r].label}</option>)}
                    </select>
                    <select value={u.business_type || "detal"} onChange={(e) => requestChange(u.user_id, u.full_name || "Usuario", "business_type", e.target.value)}
                      className="flex-1 bg-muted rounded-lg px-2 py-1.5 text-xs font-medium border border-transparent focus:border-primary focus:outline-none">
                      {Object.entries(businessMeta).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </>
                )}
                {canManageRoles && (
                  <button onClick={() => openEditModal(u)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
                    <Pencil size={14} />
                  </button>
                )}
              </div>

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
            <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button onClick={handleConfirm} size="sm" className="bg-secondary hover:bg-secondary/90">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={editModal.open} onOpenChange={(open) => setEditModal({ ...editModal, open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Editar Perfil</DialogTitle>
            <DialogDescription>Actualiza los datos del usuario</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Nombre completo</label>
              <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Teléfono / WhatsApp</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Empresa / NIT</label>
              <input value={editForm.business_name} onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })}
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Ciudad</label>
                <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Dirección</label>
                <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button onClick={saveEditProfile} size="sm" className="bg-accent hover:bg-accent/90">
              <Save size={14} className="mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <UserPlus size={18} className="text-accent" />
              Crear nuevo usuario
            </DialogTitle>
            <DialogDescription>Crea un usuario interno (operador, editor, admin). La lista de precios se asigna en Clientes, no aquí.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Email *</label>
              <input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                type="email" placeholder="correo@ejemplo.com"
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Contraseña *</label>
              <div className="relative">
                <input value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                  className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Nombre completo *</label>
              <input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                placeholder="Nombre del usuario"
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Teléfono</label>
                <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="3001234567" inputMode="tel"
                  className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Ciudad</label>
                <input value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                  className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Empresa / NIT</label>
              <input value={createForm.business_name} onChange={(e) => setCreateForm({ ...createForm, business_name: e.target.value })}
                placeholder="Opcional"
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block font-medium">Rol</label>
              <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as AppRole })}
                className="w-full bg-muted rounded-lg px-2.5 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none">
                {availableRoles.map((r) => <option key={r} value={r}>{roleMeta[r].label}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                La tipología y lista de precios se asigna por <strong>cliente</strong> en la pestaña Clientes / Contactos.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button onClick={handleCreateUser} disabled={creating} size="sm" className="bg-accent hover:bg-accent/90 gap-1.5">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {creating ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersTab;