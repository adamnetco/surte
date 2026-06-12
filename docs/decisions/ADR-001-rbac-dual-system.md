# ADR-001: Sistema dual de roles (global + per-organización)

## Status
Accepted — **con plan de migración pendiente (ver Consecuencias)**

## Date
2026-06-12

## Context

SistecPOS coexiste con dos modelos de roles:

1. **`user_roles` + enum `app_role`** — global, no scoped a `organization_id`.
   Valores: `superadmin`, `admin`, `editor`, `agente`, `cashier`, `user`.
   Lo consume **todo el frontend** (AuthContext, RoleGuard, admin_section_access) y **casi todas las policies RLS** vía `has_role(auth.uid(), 'admin'::app_role)`.

2. **`organization_members.role` (text libre)** — per-organización.
   Valores documentados en POS-primer: `owner`, `admin`, `manager`, `cashier`, `waiter`, `kitchen`, `agent`, `member`.
   Solo lo usan 4 policies (app_settings) y `TenantWorkspace.tsx`.

**Riesgos detectados (auditoría 2026-06-12):**

- 🔴 Un usuario con `admin` en `user_roles` lo es de **todas** las organizaciones simultáneamente. Rompe el aislamiento multi-tenant.
- 🟠 `organization_members.role` es `text` sin enum → typos silenciosos.
- 🟠 Lista de roles desincronizada entre TS (5) y enum DB (6: falta `cashier` en TS) — **corregido** en este ADR.
- 🟡 Las pocas policies que cruzan org+rol repiten subqueries inline a `organization_members` — **mitigado** con helper `has_org_role` en este ADR.

## Decision

**Corto plazo (aplicado):**

1. Sincronizar `AppRole` (TS) con enum `app_role` (DB) — agregar `cashier`.
2. Crear helper `public.has_org_role(_user_id uuid, _org_id uuid, _roles text[])` SECURITY DEFINER, search_path = public, REVOKE de anon. Centraliza la lógica per-org y se usará en policies futuras.
3. Documentar arquitectura RBAC actual (este ADR).

**Largo plazo (pendiente — etapa propia, NO en este ADR):**

4. Migrar `organization_members.role` a un enum `org_member_role`.
5. Mover policies que actualmente usan `has_role('admin')` a `has_org_role(org_id, ARRAY['owner','admin'])` cuando el recurso es per-tenant. `has_role('superadmin')` queda como break-glass global vía `auth_superadmin_allowlist`.
6. Deprecar el rol `admin` global de `user_roles` (mantener solo `superadmin` y `user`); todo lo demás vive en `organization_members`.

## Alternatives Considered

### Unificar en `user_roles` con `organization_id` opcional
- ✅ Una sola tabla, RLS más simple.
- ❌ Migración disruptiva: hay que reasignar los ~3 roles globales actuales y reescribir docenas de policies. No viable en este sprint.

### Eliminar `user_roles` y usar solo `organization_members`
- ✅ Modelo limpio multi-tenant.
- ❌ Pierde el concepto "superadmin de plataforma". Habría que reimplementar break-glass.

### Status quo (no hacer nada)
- ❌ Deja el bug multi-tenant abierto y la deuda crece con cada feature nuevo.

## Consequences

**Positivas:**
- `has_org_role` disponible para todas las policies nuevas → patrón único.
- TS deja de tener un blind-spot con el rol `cashier`.
- ADR sirve como brief para la etapa de migración RBAC.

**Negativas / deuda:**
- Coexistencia de dos sistemas hasta completar el largo plazo.
- Helper `has_org_role` infrautilizado hasta que se migren policies (TODO etapa siguiente).

**Acción de seguimiento:** crear spec `POS-spec rbac-unification` antes del próximo trimestre para ejecutar los puntos 4-6.

## Referencias

- `supabase/migrations/*has_org_role*` — definición del helper.
- `src/modules/auth/lib/roleCache.ts` — fuente de verdad `AppRole` (TS).
- `src/modules/auth/components/RoleGuard.tsx` — guard frontend con cache en localStorage.
- POS-primer (workspace skill) — sección "Multi-Tenancy".
- POS-roles (workspace skill) — catálogo de roles per-org.
