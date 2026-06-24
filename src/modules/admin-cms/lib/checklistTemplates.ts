import type { OrgRole } from "@/modules/platform/context/OrganizationContext";

export type ChecklistTemplateItem = { item_key: string; label: string };

export type ChecklistTemplate = {
  key: string;
  label: string;
  description: string;
  /** Roles que ven esta plantilla como sugerida (la primera coincidencia se autoselecciona). */
  roles: OrgRole[];
  items: ChecklistTemplateItem[];
};

/**
 * Plantillas de checklist por rol.
 * - Cada item_key es único por plantilla (prefijo) para que el progreso no se mezcle.
 * - El usuario puede cambiar de plantilla manualmente; el progreso vive por día/org/usuario/item_key.
 */
export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    key: "admin",
    label: "Admin / Dueño",
    description: "Cierre, finanzas y control del día",
    roles: ["owner", "admin", "manager"],
    items: [
      { item_key: "adm_caja", label: "Abrir caja del día" },
      { item_key: "adm_precios", label: "Revisar precios actualizados" },
      { item_key: "adm_stock", label: "Revisar productos con bajo stock" },
      { item_key: "adm_pedidos", label: "Despachar pedidos pendientes" },
      { item_key: "adm_dian", label: "Resolver facturas DIAN en error" },
      { item_key: "adm_cierre", label: "Cierre del día y backup" },
    ],
  },
  {
    key: "cashier",
    label: "Cajero",
    description: "Operación de caja y atención",
    roles: ["cashier"],
    items: [
      { item_key: "caj_apertura", label: "Apertura de caja con base inicial" },
      { item_key: "caj_impresora", label: "Verificar impresora y papel" },
      { item_key: "caj_terminal", label: "Probar datáfono / pagos" },
      { item_key: "caj_devoluciones", label: "Revisar devoluciones pendientes" },
      { item_key: "caj_cierre", label: "Arqueo y cierre de turno" },
    ],
  },
  {
    key: "waiter",
    label: "Mesero / Salón",
    description: "Servicio y rotación de mesas",
    roles: ["waiter"],
    items: [
      { item_key: "msa_montaje", label: "Montaje de mesas y menaje" },
      { item_key: "msa_carta", label: "Repasar carta y agotados" },
      { item_key: "msa_pedidos", label: "Atender pedidos en espera" },
      { item_key: "msa_cobros", label: "Cobrar mesas cerradas" },
      { item_key: "msa_limpieza", label: "Limpieza final del salón" },
    ],
  },
  {
    key: "kitchen",
    label: "Cocina / KDS",
    description: "Producción y mise en place",
    roles: ["kitchen"],
    items: [
      { item_key: "coc_mep", label: "Mise en place del día" },
      { item_key: "coc_temperaturas", label: "Registrar temperaturas de neveras" },
      { item_key: "coc_agotados", label: "Marcar productos agotados" },
      { item_key: "coc_kds", label: "Limpiar comandas atendidas en KDS" },
      { item_key: "coc_inventario", label: "Inventario rápido de insumos" },
    ],
  },
  {
    key: "agent",
    label: "Agente de ventas",
    description: "Prospección y seguimiento",
    roles: ["agent"],
    items: [
      { item_key: "agt_leads", label: "Revisar leads nuevos" },
      { item_key: "agt_seguimiento", label: "Seguimiento a clientes activos" },
      { item_key: "agt_cotizaciones", label: "Cotizaciones pendientes de cierre" },
      { item_key: "agt_pedidos", label: "Confirmar pedidos del día" },
      { item_key: "agt_reporte", label: "Reporte de actividad" },
    ],
  },
];

/** Devuelve la plantilla sugerida para un rol; cae en "admin" si no hay match. */
export function templateForRole(role: OrgRole | undefined | null): ChecklistTemplate {
  if (role) {
    const match = CHECKLIST_TEMPLATES.find((t) => t.roles.includes(role));
    if (match) return match;
  }
  return CHECKLIST_TEMPLATES[0];
}

export function getTemplateByKey(key: string | null | undefined): ChecklistTemplate | undefined {
  if (!key) return undefined;
  return CHECKLIST_TEMPLATES.find((t) => t.key === key);
}
