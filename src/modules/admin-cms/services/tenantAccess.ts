/**
 * tenantAccess — adaptador de infraestructura para la gestión de accesos
 * (cuentas de usuario) de un tenant.
 *
 * La capa de presentación nunca habla con Supabase directamente: pasa por aquí.
 */
import { supabase } from "@/integrations/supabase/client";

export type OrgRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "waiter"
  | "kitchen"
  | "agent"
  | "member";

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner (Dueño)",
  admin: "Admin",
  manager: "Manager",
  cashier: "Cajero",
  waiter: "Mesero",
  kitchen: "Cocina",
  agent: "Agente",
  member: "Miembro",
};

const ERRORS: Record<string, string> = {
  forbidden: "No tienes permiso para esta acción.",
  forbidden_owner_target: "Solo el owner (o un superadmin) puede modificar la cuenta del owner.",
  target_not_in_org: "El usuario no pertenece a esta tienda.",
  invalid_email: "El correo no es válido.",
  invalid_role: "El rol seleccionado no es válido.",
  weak_password: "Contraseña débil: mínimo 8 caracteres, con al menos una letra y un número.",
  create_user_failed: "No se pudo crear la cuenta de acceso.",
  set_password_failed: "No se pudo actualizar la contraseña.",
  membership_failed: "No se pudo asociar el usuario a la tienda.",
  cannot_deactivate_self: "No puedes desactivar tu propia cuenta.",
  role_change_failed: "No se pudo cambiar el rol.",
  unknown_action: "Acción no soportada.",
};

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("tenant-access-manage", { body: payload });
  const res = (data ?? {}) as Record<string, any>;
  if (error || !res.ok) {
    const key = String(res.code ?? res.error ?? "");
    throw new Error(ERRORS[key] ?? res.error ?? error?.message ?? "Error inesperado");
  }
  return res as T;
}

export type CreateMemberInput = {
  organizationId: string;
  email: string;
  fullName?: string;
  role: OrgRole;
  /** Si se omite, el backend genera una y la devuelve para comunicarla. */
  password?: string;
};

export type CreateMemberResult = {
  user_id: string;
  email: string;
  role: OrgRole;
  reused_existing_account: boolean;
  generated_password: string | null;
};

export function createTenantMember(input: CreateMemberInput) {
  return call<CreateMemberResult>({
    action: "create_member",
    organization_id: input.organizationId,
    email: input.email,
    full_name: input.fullName ?? "",
    role: input.role,
    password: input.password ?? "",
  });
}

export function setTenantMemberPassword(input: {
  organizationId: string;
  targetUserId: string;
  password: string;
}) {
  return call<{ masked_email: string | null }>({
    action: "set_password",
    organization_id: input.organizationId,
    target_user_id: input.targetUserId,
    password: input.password,
  });
}

export function deactivateTenantMember(input: { organizationId: string; targetUserId: string }) {
  return call<Record<string, never>>({
    action: "deactivate",
    organization_id: input.organizationId,
    target_user_id: input.targetUserId,
  });
}

export function reactivateTenantMember(input: { organizationId: string; targetUserId: string }) {
  return call<Record<string, never>>({
    action: "reactivate",
    organization_id: input.organizationId,
    target_user_id: input.targetUserId,
  });
}

export function changeTenantMemberRole(input: { organizationId: string; targetUserId: string; role: OrgRole }) {
  return call<{ role: OrgRole }>({
    action: "change_role",
    organization_id: input.organizationId,
    target_user_id: input.targetUserId,
    role: input.role,
  });
}

/** Contraseña sugerida legible, cumple la política del backend. */
export function suggestPassword(): string {
  const words = ["Tienda", "Caja", "Venta", "Punto", "Local", "Turno"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}!`;
}
