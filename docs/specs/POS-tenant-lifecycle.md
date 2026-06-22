# POS-tenant-lifecycle

**Estado:** SHIPPED (2026-06-22 — todos los ACs ✅, RPCs aplicadas, audit log activo)
**Módulo:** superadmin / multi-tenant
**Owner:** Eduardo (superadmin maestro)

## Problema
Necesitábamos: (a) replicar tenants completos Test→Live sin perder UUIDs, (b) borrar tenants de forma segura sin perder trazabilidad fiscal/operativa, (c) auditar acciones destructivas.

## Diseño
Todo vive en la base de datos. Cinco RPCs `SECURITY DEFINER` restringidos a superadmin maestro o rol `superadmin`:

| RPC | Qué hace |
|---|---|
| `export_tenant_snapshot(org)` | Devuelve un `jsonb` con organización, sites, dominios, miembros, módulos, licencias, sedes, categorías, marcas, productos + presentaciones, modifiers, hero, banners, landings + secciones, featured y galería. |
| `import_tenant_snapshot(payload, overwrite)` | Inserta el snapshot en el entorno actual preservando UUIDs. `ON CONFLICT (id) DO NOTHING` por fila. Salta miembros cuyo `user_id` no exista en `auth.users` del destino. |
| `archive_tenant(org, motivo)` | Soft delete: guarda snapshot en `organizations.archived_payload`, marca `deleted_at` / `deleted_by`, `is_active=false`. |
| `restore_tenant(org)` | Revierte el archive. |
| `purge_tenant_hard(org)` | Borrado físico CASCADE — exige archive previo. Usa GUC `app.allow_org_delete` para pasar el trigger de bloqueo. |

## Reglas de trazabilidad
- Tabla **`tenant_audit_log`** (id, organization_id, organization_slug, actor_id, actor_email, action, payload, created_at). Solo superadmin lee, escritura sólo desde funciones internas.
- Trigger **`trg_block_org_delete`** sobre `organizations` rechaza cualquier `DELETE` que no provenga de `purge_tenant_hard()`.
- Toda acción destructiva o de sync queda en `tenant_audit_log` con email del actor + payload (counts, motivo, slug, archived_at).

## Criterios de Aceptación
- [x] AC1: Solo superadmin puede ejecutar las 5 RPC (`_require_superadmin()`).
- [x] AC2: `DELETE FROM organizations` directo falla con `direct DELETE on organizations forbidden`.
- [x] AC3: `archive_tenant` guarda snapshot completo en `archived_payload`.
- [x] AC4: `purge_tenant_hard` falla si el tenant no está archivado.
- [x] AC5: `import_tenant_snapshot` preserva UUIDs y no rompe si el owner no existe en destino.
- [x] AC6: Cada acción produce un registro en `tenant_audit_log`.

## Workflow Test → Live (caso `demo`)
1. **Test**: `SELECT public.export_tenant_snapshot('<org-uuid>')` → copiar `jsonb`.
2. **Live → Backend → Run SQL**: pegar dentro de `import_tenant_snapshot($PAYLOAD$ ... $PAYLOAD$::jsonb, false)`.
3. Si el owner no existe en Live, crearlo en Auth y correr el `OWNER FIXUP` documentado en el runbook.

Runbook listo en: `docs/runbooks/live-import-demo-tenant.sql`.

## Workflow Borrar Tenant
1. Superadmin: `SELECT public.archive_tenant('<org-uuid>', 'motivo')`. Tenant desaparece de UIs (filtra por `is_active`/`deleted_at IS NULL`).
2. (Opcional, 90 días después) `SELECT public.purge_tenant_hard('<org-uuid>')`.
3. Si fue archive por error: `SELECT public.restore_tenant('<org-uuid>')`.
