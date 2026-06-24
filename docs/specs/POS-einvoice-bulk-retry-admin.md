# POS — Bulk Retry Admin Multi-Org (follow-up AC5)

**Estado:** DRAFT
**Módulo:** edge `einvoice-resend-bulk-admin` (NEW) + `admin-cms/Facturacion`
**Wave:** Follow-up de [POS-einvoice-retry-scoping](./POS-einvoice-retry-scoping.md) AC5

## Problema

`einvoice-resend` con `retry_all_today` ahora exige `organization_id` (POS-einvoice-retry-scoping AC1). Eso bloquea el caso superadmin que necesita reintentar pendientes a través de **varias** organizaciones desde un solo botón en `admin-cms/Facturacion`.

## Outcomes

- [ ] **AC1:** Endpoint nuevo `einvoice-resend-bulk-admin` con body `{ organization_ids: uuid[], dry_run?: bool }`.
- [ ] **AC2:** Solo accesible para `user_roles.role = 'superadmin'`; resto recibe 403.
- [ ] **AC3:** Por cada org del array, valida que el superadmin tiene visibilidad (vía `auth_superadmin_allowlist` o `has_role(user,'superadmin')`).
- [ ] **AC4:** Reutiliza la misma lógica de batch UPDATE/INSERT que `einvoice-resend`; loguea un row por org en `sync_logs` con `service_name='einvoice_bulk_retry_admin'`.
- [ ] **AC5:** UI en `admin-cms` con selector de orgs (multi-select) + preview `dry_run`.

## Notas

- No exponer en POS: solo en `/admin/facturacion/bulk-retry`.
- Considerar rate-limit (1 ejecución por minuto por superadmin) para evitar disparos accidentales masivos.
