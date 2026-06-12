
# SistecPOS Core — Auditoría y rediseño del dominio Tenancy + Licensing

Aplicando el skill **SaaS ERP System Design** sobre el flujo actual de Tiendas → Planes → Licencias → Módulos. Entrega: diagnóstico, modelo objetivo y plan de implementación por fases. No se modifica código en este paso.

---

## 1. Mapa de dominio actual (capacidades)

| Capacidad | Tablas clave | Estado |
|---|---|---|
| Identidad de tenant | `organizations`, `tenant_sites`, `tenant_domains` | OK, pero `organizations` mezcla branding, POS settings y ciclo de vida |
| Membresía y roles | `organization_members`, `user_roles`, `profiles` | OK |
| Catálogo comercial | `saas_plans`, `modules`, `plan_modules` | **Duplicidad**: `saas_plans.modules` (jsonb) y `plan_modules` (tabla) coexisten |
| Entitlements runtime | `organization_modules` (toggle por tenant) | Solo on/off, sin overrides ni límites |
| Licenciamiento | `licenses`, `license_activations`, `license_audit` | Desacoplado de plan/subscription |
| Facturación | `subscriptions`, `subscription_invoices`, `dunning_events` | Existe pero no enlaza con licencia/entitlements |
| Auditoría | `tenant_audit_log` | Existe, poco usado |
| Onboarding | `org_signup_requests`, `onboarding_progress`, `TenantOnboardingWizard` | Funciona pero ambigüedad UI (Tienda vs Organización ya resuelta) |

### Puntos de fricción detectados

1. **Doble fuente de verdad** para "qué módulos tiene un plan": `saas_plans.modules` (jsonb array) y `plan_modules` (FK). Se desincronizan.
2. **Entitlements pobres**: `organization_modules` solo es boolean. No hay `limits`, ni overrides enterprise, ni `expires_at`.
3. **Licencia ≠ Subscription ≠ Plan**: tres objetos conviven sin un workflow único (`pending → active → suspended → archived`).
4. **Sin lifecycle explícito de tenant**: `organizations.is_active` + `deleted_at` no expresan estados `pending/trial/active/past_due/suspended/archived`.
5. **Auditoría no obligatoria** en mutaciones superadmin (suspender tenant, revocar licencia, cambiar plan, override de módulo). `tenant_audit_log` se llena de forma inconsistente.
6. **Acciones destructivas sin co-sign** (hard-delete tenant, revoke license, bulk suspend).
7. **Back-office**: faltan vistas de Approvals queue, Bulk ops con dry-run, Impersonation auditada y time-boxed.

---

## 2. Modelo objetivo (per-capacidad)

### 2.1 Catálogo comercial — única fuente de verdad

- **Deprecar** `saas_plans.modules` (jsonb). `plan_modules` es la verdad.
- Añadir `plan_limits (plan_id, limit_key, value)` para cuotas (terminales, usuarios, productos, sucursales, llamadas API).
- Añadir tabla `features` y `plan_features` separadas de `modules` (un módulo agrupa features; una feature es atómica para gating).

### 2.2 Entitlements runtime (resolver único)

Nuevas tablas:
- `tenant_module_overrides(organization_id, module_key, enabled, reason, expires_at, granted_by)`
- `tenant_limit_overrides(organization_id, limit_key, value, reason, expires_at, granted_by)`
- `tenant_usage_counters(organization_id, limit_key, period_key, used)` para enforcement atómico.

Precedencia: **override > plan_modules baseline > deny por defecto**.

Edge function `resolve-entitlements(org_id)` que el front consume y cachea (60s) + claim en JWT al iniciar sesión.

### 2.3 Lifecycle de tenant (state machine explícita)

```text
pending → trial → active → past_due → suspended → archived → (hard_delete)
```

- Añadir `organizations.lifecycle_state` (enum) + `lifecycle_changed_at`.
- Trigger que rechaza transiciones inválidas y escribe en `tenant_audit_log`.
- Cada estado mapea a un comportamiento del runtime (trial → banner cuenta atrás; past_due → bloqueo de mutaciones; suspended → solo lectura; archived → invisible).

### 2.4 Licencias = artefacto operacional del plan

- Mantener `licenses` para activación por terminal (POS offline-first ya lo requiere).
- Añadir `licenses.subscription_id` FK → `subscriptions`, y `licenses.plan_id` heredado.
- Issue de licencia debe pasar por un service único `issueLicense(orgId, plan, maxTerminals, reason)` que escribe en `license_audit` + `tenant_audit_log`.

### 2.5 Back-office Superadmin (saas-admin-backoffice-tooling)

Vistas a añadir/consolidar:

1. **Tenant 360°** (`/superadmin/t/:slug`): banner (ya hecho) + tabs: Resumen, Plan & Licencias, Módulos & Límites, Miembros, Auditoría, Facturación, Sitios.
2. **Approvals queue** (`/superadmin/approvals`): `org_signup_requests` + override requests + acciones críticas pendientes de co-sign.
3. **Impersonation**: time-boxed 30min, justification obligatoria, banner visible al tenant, audit log.
4. **Bulk ops** (`/superadmin/bulk`): plan migration, mass-suspend, feature rollout. Siempre con dry-run + segundo aprobador para ejecución.
5. **Audit log viewer** (`/superadmin/audit`): filtros por actor, target_tenant, action, fecha. Export CSV.

### 2.6 Pipeline auditado de mutación

Todo write de superadmin pasa por wrapper:

```ts
auditedMutation({
  action: 'TENANT_SUSPEND',
  targetTenant,
  justification,            // required for high-risk
  requiresCoSign: false,
  before, after,
  exec: async () => { ... }
})
```

Inserta en `tenant_audit_log` dentro de la misma tx que el cambio.

---

## 3. Diagrama del modelo objetivo

```text
┌────────────────┐    ┌──────────────────┐    ┌───────────────────────┐
│  saas_plans    │───▶│   plan_modules   │───▶│       modules         │
│  (catálogo)    │    │   plan_limits    │    │       features        │
└────────┬───────┘    └──────────────────┘    └───────────────────────┘
         │                       ▲
         │                       │ resolve-entitlements()
         ▼                       │ (precedencia override > baseline)
┌────────────────┐    ┌──────────────────────────┐
│ subscriptions  │───▶│  organization_modules    │
│ (Stripe/manual)│    │  tenant_module_overrides │
└────────┬───────┘    │  tenant_limit_overrides  │
         │            │  tenant_usage_counters   │
         ▼            └──────────────────────────┘
┌────────────────┐              ▲
│   licenses     │──────────────┤  (entitlements consultados en runtime)
│  + activations │              │
└────────┬───────┘              │
         │                      │
         ▼                      │
┌──────────────────────────────────────┐
│  organizations  (lifecycle_state)    │
│  pending→trial→active→past_due→...   │
└──────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ tenant_audit_log   │  ← TODA mutación superadmin
        └────────────────────┘
```

---

## 4. Plan de implementación por fases

### Fase 1 — Consolidación del catálogo (sin breaking changes)
1. Migración: dejar `plan_modules` como única fuente; añadir vista `v_plan_modules_resolved` que `saas_plans.modules` lee para compatibilidad.
2. Crear `plan_limits` con seeds para `max_terminals`, `max_users`, `max_locations`, `max_products`.
3. UI superadmin `/superadmin/plans`: editor único Plan × Módulos × Límites.

### Fase 2 — Entitlements runtime
4. Tablas `tenant_module_overrides`, `tenant_limit_overrides`, `tenant_usage_counters` + RLS + GRANT.
5. Edge function `resolve-entitlements`.
6. Hook React `useEntitlements()` + `<Gate feature="..."/>`.
7. Reemplazar checks dispersos por el resolver.

### Fase 3 — Lifecycle de tenant
8. Columna `lifecycle_state` + trigger de validación + backfill desde `is_active`/`deleted_at`.
9. UI Tenant 360°: badge de estado + acciones de transición.
10. Runtime: bloqueo de mutaciones en `suspended`/`past_due`.

### Fase 4 — Pipeline auditado + back-office
11. `auditedMutation()` helper + adopción en suspend/restore/issue-license/revoke/override.
12. Audit log viewer.
13. Approvals queue (unifica `org_signup_requests` + requests críticos).
14. Impersonation time-boxed + banner visible.
15. Bulk ops con dry-run + co-sign (acciones high-risk: hard-delete, mass-suspend, plan migration).

### Fase 5 — Licencia integrada a subscription
16. FK `licenses.subscription_id`. Renovación automática al renovar subscription. Suspensión en `past_due`.

---

## 5. Detalle técnico (referencias de archivos)

- **Wizard tenant**: `src/modules/superadmin/components/TenantOnboardingWizard.tsx` — añadir paso "Plan & Límites" que escriba `subscriptions` + `plan_modules` snapshot a `organization_modules`.
- **Tenant 360°**: extender `src/modules/superadmin/pages/TenantWorkspace.tsx` con tabs nuevas.
- **License section**: `TenantLicenseSection.tsx` ya tenant-scoped → conectar a `subscriptions`.
- **Audit helper**: nuevo `src/modules/superadmin/lib/auditedMutation.ts`.
- **Entitlements**: nuevo `src/lib/entitlements/` (resolver, hook, Gate component).
- **Edge function**: `supabase/functions/resolve-entitlements/index.ts`.
- **Migraciones** (orden): `plan_limits` → overrides tables → `tenant_usage_counters` → `organizations.lifecycle_state` → triggers.

---

## 6. Decisiones que necesito confirmar antes de codear

1. **Suscripciones**: ¿integramos Stripe ahora o mantenemos `subscriptions` manual gestionado por superadmin? (afecta Fase 5)
2. **Granularidad de gating**: ¿módulos atómicos bastan o necesitamos features dentro de módulos desde ya?
3. **Co-sign**: ¿qué acciones consideras high-risk para exigir doble aprobación? Sugerencia: hard-delete, mass-suspend, override de límite > x10 del plan, revoke de licencia activa.
4. **Empezar por qué fase**: recomiendo Fase 1 + 3 (catálogo único + lifecycle) primero porque desbloquean el resto sin romper nada.

---

Used the **SaaS ERP System Design**, **SaaS Entitlements and Plan Gating**, **Multi-Tenant SaaS Architecture** y **SaaS Admin / Back-Office Tooling** skills.
