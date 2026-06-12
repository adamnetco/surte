---
name: RBAC Dual System
description: SistecPOS coexiste con dos sistemas de roles (user_roles global + organization_members per-org); helper has_org_role y plan de unificación.
type: feature
---
# RBAC en SistecPOS

## Estado actual (2026-06-12)

**Sistema 1 — Global (`user_roles` + enum `app_role`)**
- Roles: `superadmin`, `admin`, `editor`, `agente`, `cashier`, `user`.
- Usado por: AuthContext, RoleGuard, admin_section_access, ~95% de RLS policies vía `has_role(auth.uid(), 'admin'::app_role)`.
- `is_master_superadmin()` revisa `auth_superadmin_allowlist` (break-glass).
- ⚠️ NO tiene `organization_id` → un `admin` lo es de TODAS las orgs.

**Sistema 2 — Per-organización (`organization_members.role` text libre)**
- Roles documentados (POS-primer): owner, admin, manager, cashier, waiter, kitchen, agent, member.
- Usado por: 4 policies (app_settings) + TenantWorkspace.tsx.

## Helpers RLS disponibles

```sql
public.has_role(_user_id, _role app_role)              -- global, incluye superadmin bypass
public.has_org_role(_user_id, _org_id, _roles text[])  -- per-org, incluye superadmin bypass + is_active=true
public.is_master_superadmin(_user_id)                  -- allowlist break-glass
public.get_current_user_role()                          -- rol más alto del user actual
```

**Para policies nuevas en tablas con `organization_id`:** usar `has_org_role`, NO `has_role`.

## Frontend

`AppRole` se define en `src/modules/auth/lib/roleCache.ts` — DEBE permanecer sincronizado con el enum `app_role` de la DB.

`RoleGuard` (`src/modules/auth/components/RoleGuard.tsx`) consulta `admin_section_access` y cachea `allowed_roles` por sección en localStorage (`sps_section_allowed:<section>`).

## Deuda técnica (TODO etapa propia)

1. Migrar `organization_members.role` a enum `org_member_role`.
2. Migrar policies tenant-scoped de `has_role('admin')` → `has_org_role(org_id, ARRAY['owner','admin'])`.
3. Deprecar rol global `admin` (dejar solo `superadmin` y `user` en `user_roles`).

Ver ADR-001 (`docs/decisions/ADR-001-rbac-dual-system.md`) para el plan completo.
