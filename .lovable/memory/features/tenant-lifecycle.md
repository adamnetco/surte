---
name: Tenant Lifecycle
description: RPCs export/import/archive/restore/purge_tenant_hard + tenant_audit_log para sync Test→Live y soft delete con trazabilidad
type: feature
---
Gestión completa del ciclo de vida de tenants:

- `export_tenant_snapshot(org)` / `import_tenant_snapshot(payload, overwrite)` — replican un tenant entre entornos preservando UUIDs.
- `archive_tenant(org, motivo)` — soft delete con snapshot en `organizations.archived_payload`.
- `restore_tenant(org)` — revierte.
- `purge_tenant_hard(org)` — borrado físico CASCADE (exige archive previo). Trigger `trg_block_org_delete` impide DELETE directo.

Auditoría: tabla `tenant_audit_log` (solo superadmin lee), poblada por `_tenant_log()`.

Todas las RPC requieren superadmin maestro o rol `superadmin` (`_require_superadmin()`).

Spec: docs/specs/POS-tenant-lifecycle.md
Runbook demo→Live: docs/runbooks/live-import-demo-tenant.sql
