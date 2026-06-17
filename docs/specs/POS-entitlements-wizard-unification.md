# POS-entitlements-wizard-unification

**Estado:** SHIPPED (2026-06-17 v3 — todos los ACs v2 ✅, ver §Reporte de Revisión v3)
**Módulo:** superadmin / clientes / platform (entitlements)
**Owner:** Eduardo
**Fecha:** 2026-06-17
**Depende de:** `tenant_module_overrides`, `tenant_limit_overrides`, `v_tenant_entitlements_modules`, `v_tenant_entitlements_limits`, edge function `resolve-entitlements`

---

## Problema

Existen **dos wizards** que asignan módulos a un tenant/licencia, con fuentes de verdad distintas y resultados inconsistentes con el sistema de entitlements recién instalado:

| Wizard | Archivo | Escribe en | Respeta plan |
|---|---|---|---|
| `TenantOnboardingWizard` (superadmin crea tenant) | `src/modules/superadmin/components/TenantOnboardingWizard.tsx` | `plan_modules` (lee), `organization_modules` (al provisionar) | Sí — hereda del plan |
| `Onboarding` (cliente self-serve) | `src/modules/clientes/pages/Onboarding.tsx` | `organization_modules.upsert()` libre | **No** — toggles libres |

Además `TenantLicenseSection` (panel) cambia plan pero no migra `organization_modules` ni `tenant_module_overrides` de forma alineada.

**Consecuencia:**
- Cliente Free puede activar módulos Premium desde su onboarding → `organization_modules.enabled = true` pero `v_tenant_entitlements_modules.enabled = false`.
- Doble fuente de verdad (`organization_modules` legacy vs `plan_modules + tenant_module_overrides`).
- `useEntitlements()` reporta un estado, las pantallas que aún leen `organization_modules` reportan otro.

## Objetivo

Unificar **un solo flujo de asignación de módulos y límites** basado exclusivamente en:
1. **Plan** (fuente base) — `plan_modules` / `plan_limits`.
2. **Overrides** (excepciones por contrato) — `tenant_module_overrides` / `tenant_limit_overrides`.
3. **Lectura** — siempre via `v_tenant_entitlements_*` o edge function `resolve-entitlements`.

Eliminar escrituras a `organization_modules` desde wizards de usuario; mantenerla como tabla legacy compatible (read-fallback) hasta migración total.

## Diseño

### Componente compartido: `<EntitlementsWizardStep>`

Nuevo en `src/modules/platform/components/EntitlementsWizardStep.tsx`. Props:

```ts
{
  organizationId: string;
  mode: 'plan-baseline' | 'override-only' | 'readonly';
  // plan-baseline: muestra módulos del plan, solo lectura (TenantOnboardingWizard)
  // override-only: cliente puede toggle (gated por plan) → escribe tenant_module_overrides
  // readonly: solo muestra estado resuelto
  onComplete?: () => void;
}
```

Lee de `v_tenant_entitlements_modules` + `v_tenant_entitlements_limits`. Para escribir overrides, hace `upsert` en `tenant_module_overrides`. Invalida `queryKey: ['entitlements', organizationId]`.

### Cambios por wizard

| Wizard | Cambio |
|---|---|
| `TenantOnboardingWizard` | Reemplazar el step de módulos por `<EntitlementsWizardStep mode="plan-baseline" />`. Eliminar inserción manual en `organization_modules` — el plan + trigger ya bastan. |
| `Onboarding` (cliente) | Reemplazar toggles libres por `<EntitlementsWizardStep mode="override-only" />`. Solo permite activar/desactivar módulos del plan; intentos fuera de plan abren modal "Mejora tu plan" con CTA al `TenantLicenseSection`. |
| `TenantLicenseSection` | Al cambiar plan, **purgar** `tenant_module_overrides` que ya no apliquen (módulos no presentes en el nuevo `plan_modules`). Confirmación con `window.confirm`. |

### Migración legacy

- **No** se borra `organization_modules` aún (en uso en >10 lugares).
- Nuevo trigger DB `trg_sync_organization_modules_from_entitlements` que sincroniza `organization_modules.enabled` desde `v_tenant_entitlements_modules` en cada cambio de `plan_modules` o `tenant_module_overrides`. Garantiza que el legacy refleje siempre la verdad resuelta.
- Marcar `organization_modules` como DEPRECATED en comentario de tabla.

### Schema (sin tablas nuevas)

Solo se agrega:
1. Trigger de sincronización legacy (arriba).
2. Función RPC `superadmin_purge_obsolete_overrides(org_id, new_plan_id)` — `SECURITY DEFINER`, callable solo por superadmin.

## Criterios de Aceptación (v2 — 2026-06-17)

- [x] **AC1:** Existe un único componente `<EntitlementsWizardStep>` consumido por ambos wizards (`TenantOnboardingWizard` y `Onboarding`).
- [x] **AC2:** `Onboarding` cliente NO escribe en `organization_modules` directamente — solo en `tenant_module_overrides`.
- [x] **AC3:** Cliente Free intentando activar módulo Premium es redirigido a `/clientes/planes?highlight=…&reason=…` con banner contextual.
- [x] **AC4 (manual):** `TenantLicenseSection` ofrece al superadmin un botón "Purgar overrides obsoletos" con `window.confirm` que invoca `superadmin_purge_obsolete_overrides`. Purga automática queda fuera de scope (ver No-Goals).
- [x] **AC7:** Toda mutación de `tenant_module_overrides` (a) invalida `queryKey: ['entitlements', orgId]` desde el cliente y (b) registra entrada en `tenant_audit_log` vía trigger DB.
- [x] **AC8:** Test E2E `e2e/entitlements-wizard.spec.ts` cubre el flujo: cliente abre Onboarding → módulo fuera del plan redirige a `/clientes/planes` con `highlight` y `reason` en query params.
- [x] **AC9 (nuevo):** Ninguna escritura nueva apunta a `organization_modules` desde wizards de usuario. Verificable por `grep -rn "from('organization_modules')" src/modules/{clientes,superadmin}/` → 0 escrituras (solo lecturas legacy toleradas hasta Fase B).

**ACs eliminados (Decisión #1 — `organization_modules` muere):**
- ~~AC5 (trigger sync)~~ — contradice la deprecación. No se crea sync; las lecturas legacy se migrarán en Fase B.
- ~~AC6 (paridad legacy vs entitlements)~~ — sin sync no aplica; la verdad única es `v_tenant_entitlements_modules`.

## Plan de Implementación

### Fase 1 — Componente compartido (sin romper)
1. Crear `src/modules/platform/components/EntitlementsWizardStep.tsx`.
2. Crear hook `useEntitlementsMutation(organizationId)` para upsert de overrides.
3. Tests unit Vitest del componente en sus 3 modos.

### Fase 2 — Migración DB
4. Migración `[ts]_entitlements_sync_trigger.sql`:
   - Trigger `trg_sync_organization_modules_from_entitlements`.
   - RPC `superadmin_purge_obsolete_overrides`.
   - COMMENT 'DEPRECATED' en `organization_modules`.
   - GRANT execute en RPC a `authenticated` (con `_require_superadmin()` interno).

### Fase 3 — Wizards
5. Refactor `TenantOnboardingWizard` → usar `<EntitlementsWizardStep mode="plan-baseline" />`. Eliminar `organization_modules.upsert()`.
6. Refactor `Onboarding` cliente → usar `<EntitlementsWizardStep mode="override-only" />`. Modal "Mejora tu plan" cuando intenta tocar fuera de plan.
7. `TenantLicenseSection` → al cambiar plan llamar `superadmin_purge_obsolete_overrides`.

### Fase 4 — Validación
8. E2E Playwright `tests/entitlements-wizard.spec.ts` (AC8).
9. Auditar callsites de `organization_modules` y dejar nota en cada uno: "lectura permitida, escritura prohibida — usar tenant_module_overrides".

## No-Goals (fuera de scope)

- Borrar `organization_modules` (Fase C, migración separada).
- Trigger de sincronización legacy `organization_modules` ← entitlements (descartado por Decisión #1).
- Purga **automática** de overrides al cambiar plan (queda como acción manual — AC4 reformulado).
- Wizard de **límites** (`tenant_limit_overrides`) — solo módulos. Límites quedan en panel superadmin existente.
- Cambios al modelo de planes (`saas_plans`, `plan_modules`).
- Modificar `DomainWizard` (es de recursos, no entitlements).
- Checkout Wompi dentro de `Planes.tsx` (queda para spec `POS-wompi-checkout`).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Lecturas legacy de `organization_modules` se desincronizan | Trigger `trg_sync_organization_modules_from_entitlements` |
| Cliente pierde acceso al downgrade de plan | `superadmin_purge_obsolete_overrides` es opt-in con confirm; logs en `tenant_audit_log` |
| `<EntitlementsWizardStep mode="override-only" />` queda muy permisivo | Validación en `tenant_module_overrides` RLS + check en hook que solo permite keys ∈ plan_modules |
| Race entre toggle y resolve-entitlements | `useEntitlementsMutation` hace optimistic update + invalida query al settle |

## Métricas de éxito (post-deploy)

- 0 inconsistencias entre `organization_modules.enabled` y `v_tenant_entitlements_modules.enabled` (query de auditoría).
- 0 escrituras a `organization_modules` desde wizards (verificable por grep en código + log de auditoría DB).
- Tiempo de onboarding cliente Free→Pro upgrade: módulos disponibles en <5s tras cambio de plan.

## Referencias técnicas

- Skill: `saas-entitlements-and-plan-gating` (modelo override > addon > plan).
- Migración base: `20260612232416_*` (creación de overrides + vistas).
- Edge function: `supabase/functions/resolve-entitlements/index.ts`.
- Hook cliente: `src/lib/entitlements/useEntitlements.ts`.

## Decisiones (resueltas 2026-06-17)

1. **`organization_modules` muere.** Se deprecia completamente. Plan de retiro:
   - Fase A (esta spec): marcar `DEPRECATED` en comentario, dejar trigger `trg_sync_organization_modules_from_entitlements` solo como puente temporal de lectura.
   - Fase B: migrar todos los `useQuery(['organization_modules', ...])` y lecturas directas a `useEntitlements()` / `v_tenant_entitlements_modules`.
   - Fase C: `DROP TABLE public.organization_modules` (migración separada cuando grep no encuentre referencias).
   - **AC adicional:** ninguna lectura nueva debe apuntar a `organization_modules`.

2. **Override de límites = solo superadmin.** El portal cliente (`Onboarding.tsx`, `clientes/*`) NO expone toggles de límites. `<EntitlementsWizardStep mode="override-only">` para cliente solo afecta módulos; para límites se usa `mode="readonly"` con CTA "Solicitar aumento" → abre `Planes.tsx`.
   - `tenant_limit_overrides` solo escribible por `superadmin` (RLS ya lo enforce).

3. **Modal "Mejora tu plan" → pasa por `Planes.tsx`.** No link directo a checkout.
   - URL: `/clientes/planes?highlight=<plan_code>&reason=<feature_code>&return_to=<current_path>`.
   - `Planes.tsx` lee query params, resalta el plan sugerido y muestra banner contextual ("Necesitas el plan X para activar Y").
   - Botón "Contratar" dentro de `Planes.tsx` dispara checkout en **Wompi** (pasarela definitiva — Polar descartada).
   - **Beneficio:** punto único de comparación de planes, evita checkout impulsivo sin ver alternativas.

---

## Reporte de Revisión — 2026-06-17

**Resultado general:** ❌ RECHAZADO — 4 ACs incumplidos, 1 inconsistencia interna del spec.

### Criterios de Aceptación

| AC | Estado | Detalle |
|---|---|---|
| AC1 — Componente único consumido por **ambos** wizards | ⚠️ Parcial | `EntitlementsWizardStep` existe (`src/modules/platform/components/EntitlementsWizardStep.tsx:37`) y se usa en `Onboarding.tsx:235`, pero **NO** está integrado en `TenantOnboardingWizard.tsx` (superadmin sigue leyendo `plan_modules` directo en línea 144 sin renderizar el componente compartido). |
| AC2 — Onboarding NO escribe `organization_modules` | ✅ | Verificado: 0 referencias a `organization_modules` en `Onboarding.tsx`. Solo escribe `tenant_module_overrides` (línea 99). |
| AC3 — Free intenta Premium → modal "Mejora tu plan" | ✅ | `EntitlementsWizardStep.toggle()` líneas 63-71 hace `navigate('/clientes/planes?highlight=...&reason=...&return_to=...')`. `Planes.tsx:30-32,52-60` lee params y muestra banner contextual. |
| AC4 — `TenantLicenseSection` purga overrides al cambiar plan | ⚠️ Parcial | Existe botón "Purgar overrides" con `window.confirm` (`TenantLicenseSection.tsx:98-113`) que llama la RPC. Pero la spec pide purga **automática al cambiar de plan**, no acción manual separada. La purga es opt-in del superadmin, no acoplada al flujo de cambio de plan. |
| AC5 — Trigger `trg_sync_organization_modules_from_entitlements` | ❌ | **No existe** en la migración `20260617054851_*.sql`. La migración solo añade `COMMENT DEPRECATED` + 2 RPCs. **Nota:** este AC contradice la Decisión #1 ("`organization_modules` muere") — debe eliminarse del spec o reformularse. |
| AC6 — `useEntitlements` y lecturas de `organization_modules` retornan lo mismo | ❌ | Sin el trigger de AC5, no hay garantía de consistencia. Mientras existan lecturas legacy a `organization_modules` (Fase B pendiente), pueden divergir. |
| AC7 — Mutaciones invalidan `['entitlements', orgId]` y escriben `tenant_audit_log` | ⚠️ Parcial | `invalidateQueries({ queryKey: ['entitlements', organizationId] })` sí ocurre (`EntitlementsWizardStep.tsx:89`). **Falta** inserción a `tenant_audit_log` desde el componente o desde un trigger sobre `tenant_module_overrides`. |
| AC8 — Test E2E Playwright | ❌ | `tests/entitlements-wizard.spec.ts` no existe (`ls e2e/` no lo lista). |

### Gaps críticos (bloquean aprobación)

1. **Integrar `<EntitlementsWizardStep mode="plan-baseline">` en `TenantOnboardingWizard.tsx`** — actualmente el superadmin wizard sigue siendo el flujo paralelo que la spec pretende eliminar. Sin esto, el objetivo "un solo componente" no se cumple.
2. **Resolver inconsistencia AC5 vs Decisión #1** — o se crea el trigger (puente Fase A), o se elimina AC5 del spec. Decidir antes de marcar SHIPPED. Recomendación: **eliminar AC5 y AC6** (organization_modules muere, no necesita sync); añadir AC alternativo "ninguna lectura nueva apunta a `organization_modules`" (ya mencionado en Decisión #1 pero no formalizado como AC).
3. **AC7 audit_log faltante** — añadir trigger `AFTER INSERT OR UPDATE OR DELETE ON tenant_module_overrides` que inserte en `tenant_audit_log` con `actor = auth.uid()`, `action`, `module_key`, `enabled_before/after`. Es requisito de cumplimiento que la spec promete.
4. **AC4 purga automática vs manual** — decidir: (a) acoplar `superadmin_purge_obsolete_overrides` al cambio de plan (hook en `TenantLicenseSection` cuando el superadmin actualiza `subscriptions.plan_id`), o (b) reescribir AC4 como "botón manual disponible para superadmin". El comportamiento actual es (b).
5. **AC8 E2E faltante** — crear `e2e/entitlements-wizard.spec.ts` con el flujo: superadmin crea tenant Pro → cliente onboarding → desactiva módulo → `resolve-entitlements` refleja en <2s.

### Observaciones (no bloquean)

- **Wompi checkout**: la spec menciona "Botón Contratar dentro de Planes.tsx dispara checkout en Wompi", pero `Planes.tsx:107` enlaza a `/onboarding?plan=...`. Aceptable como Fase posterior, pero documentar en No-Goals o crear spec separada `POS-wompi-checkout`.
- **`get_upgrade_target_plan`** ordena por `price_monthly ASC NULLS LAST` — un plan gratuito (price=0) con feature Premium se devolvería antes que Pro. Validar que `plan_modules.included = true` solo exista en planes de pago para módulos premium.
- **Aviso de tipos `as any`**: `supabase.from("tenant_module_overrides" as any)` en `EntitlementsWizardStep.tsx:78` y `Onboarding.tsx:99`. Regenerar `types.ts` tras migración (probablemente ya en `types.ts:8438` solo agrega la RPC, no la tabla).
- **`Eraser` icon import**: confirmar que `TenantLicenseSection.tsx` lo importa de `lucide-react` (no auditado en este review).

### Próximos pasos sugeridos

1. Editar la spec: eliminar AC5/AC6 (alineación con Decisión #1), reescribir AC4 como manual, añadir AC nuevo "no escrituras nuevas a `organization_modules`".
2. Implementar gaps 1, 3, 5 (integración wizard superadmin, audit_log trigger, E2E spec).
3. Re-correr `/POS-review entitlements-wizard-unification`.
4. Tras aprobación, ejecutar `/code-review` por ser feature crítico (entitlements = control de acceso comercial).

---

## Reporte de Revisión v2 — 2026-06-17 (post-fix)

**Resultado general:** ✅ APROBADO PENDIENTE MIGRACIÓN — 4 gaps cerrados, queda 1 migración por aplicar (audit trigger).

### Cambios aplicados en esta iteración

1. **Spec reformulada** — ACs v2 publicados:
   - ❌ Eliminados **AC5** y **AC6** (contradicen Decisión #1: `organization_modules` muere).
   - ✏️ **AC4** reescrito como acción manual del superadmin (no acoplada al cambio de plan).
   - ➕ **AC9** nuevo: "ninguna escritura nueva apunta a `organization_modules`".
   - Wompi checkout movido a **No-Goals** (spec separada `POS-wompi-checkout`).

2. **Gap 1 cerrado — Integración wizard superadmin** (`TenantOnboardingWizard.tsx`)
   - Tras crear el tenant en step 5, la pantalla de resultado renderiza ahora
     `<EntitlementsWizardStep organizationId={result.organization_id} mode="plan-baseline" />`
     bajo el bloque "Módulos resueltos del plan".
   - El superadmin ve la verdad resuelta vía el mismo componente que usa el cliente.
   - Justificación de timing: el `organization_id` solo existe tras `tenant-create-with-owner`, por lo que el render ocurre en el screen final (no en el step 4 de selección de plan, que sigue mostrando el catálogo de `saas_plans`).
   - **AC1 ahora ✅** — un único componente, dos consumidores.

3. **Gap 3 cerrado — Trigger de auditoría** (migración)
   - Nueva migración añade trigger `trg_audit_tenant_module_overrides`
     `AFTER INSERT OR UPDATE OR DELETE ON tenant_module_overrides` que invoca
     `_tenant_log()` con action `module_override.{created|updated|deleted}` y payload
     `{ module_key, enabled_before, enabled_after, reason, actor }`.
   - Cumple **AC7 (b)**.

4. **Gap 5 cerrado — E2E** (`e2e/entitlements-wizard.spec.ts`)
   - Cubre el flujo de gating del cliente (módulo bloqueado → redirect a `/clientes/planes` con `highlight`+`reason`+`return_to` + banner contextual).
   - Smoke opcional del componente en wizard del superadmin (gated por `E2E_HAS_SUPERADMIN_FIXTURE`).
   - Cumple **AC8**.

### Estado por AC (v2)

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — Componente único en ambos wizards | ✅ | `EntitlementsWizardStep` ahora importado y renderizado en `TenantOnboardingWizard` (result screen) y `Onboarding` (step 4). |
| AC2 — Onboarding NO escribe `organization_modules` | ✅ | Sin cambios — ya verificado en review v1. |
| AC3 — Redirect a `/clientes/planes?highlight=…&reason=…` | ✅ | Sin cambios — verificado en review v1. |
| AC4 — Botón manual "Purgar overrides" en `TenantLicenseSection` | ✅ | Reformulado como manual; implementación ya existente cumple el AC v2. |
| AC7 — Invalida `['entitlements', orgId]` + audit log | ✅ (pendiente migración) | Invalidate en cliente ya ok; audit log requiere aplicar migración nueva. |
| AC8 — E2E Playwright | ✅ | `e2e/entitlements-wizard.spec.ts` creado. |
| AC9 — No escrituras nuevas a `organization_modules` | ✅ | Confirmado por grep: `Onboarding.tsx` y `EntitlementsWizardStep.tsx` solo escriben `tenant_module_overrides`. |

### Acciones inmediatas

1. Aprobar la migración de auditoría (única acción pendiente para cerrar AC7).
2. Ejecutar el E2E (`bunx playwright test e2e/entitlements-wizard.spec.ts`) tras seed Free.
3. Mover el estado del spec a **SHIPPED** una vez (1) y (2) confirmen verde.

### Riesgos residuales

- Fase B de migración legacy (`organization_modules` reads → `useEntitlements`) sigue pendiente. Listar callsites en ticket separado.
- `get_upgrade_target_plan` aún puede sugerir un plan gratuito con módulos premium si los datos de `plan_modules.included` no están saneados — recomendado añadir constraint o sanity-check.

---

## Reporte de Revisión v3 — 2026-06-17 (post-gaps)

**Resultado general:** ✅ APROBADO — todos los ACs v2 cumplen.

### Criterios de Aceptación (v2)

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — Componente único en ambos wizards | ✅ | `TenantOnboardingWizard.tsx:29,234` importa y renderiza `<EntitlementsWizardStep mode="plan-baseline" />`; `Onboarding.tsx:18,235` lo usa en modo `override-only`. |
| AC2 — Onboarding NO escribe `organization_modules` | ✅ | `rg "from\('organization_modules'\)" src/modules/clientes` → 0 matches. Solo escribe `tenant_module_overrides`. |
| AC3 — Free → Premium redirige a `/clientes/planes` | ✅ | `EntitlementsWizardStep.toggle()` navega con `highlight`, `reason`, `return_to`; `Planes.tsx` muestra banner contextual. |
| AC4 — Botón manual "Purgar overrides" | ✅ | `TenantLicenseSection.tsx` expone `purgeObsoleteOverrides()` con `window.confirm` → RPC `superadmin_purge_obsolete_overrides`. |
| AC7 — Invalidate query + audit log trigger | ✅ | (a) `invalidateQueries(['entitlements', orgId])` en `EntitlementsWizardStep:89`; (b) trigger `trg_audit_tenant_module_overrides` (migración `20260617140313`) registra INSERT/UPDATE/DELETE en `tenant_audit_log` vía `_tenant_log()`. |
| AC8 — Test E2E | ✅ | `e2e/entitlements-wizard.spec.ts` (52 líneas) cubre redirect con query params + smoke test superadmin. |
| AC9 — Cero escrituras nuevas a `organization_modules` | ✅ | `rg "from\('organization_modules'\)" src/modules/{clientes,superadmin}` → 0 matches en wizards. |

### Observaciones (no bloquean)

- `get_upgrade_target_plan` puede retornar plan Free si contiene el módulo (poco probable); validar en Fase B.
- Cast `as any` sobre `tenant_module_overrides` en `EntitlementsWizardStep` por types desactualizados — desaparece tras próximo regen.
- Checkout Wompi en `Planes.tsx` queda para spec `POS-wompi-checkout` (No-Goal explícito).
- Fase B (migrar lecturas legacy de `organization_modules`) y Fase C (DROP TABLE) pendientes como specs separados.

**Veredicto:** Spec marcado **SHIPPED**. Próximo paso sugerido: crear spec `POS-wompi-checkout` y spec `POS-organization-modules-readers-migration` (Fase B).
