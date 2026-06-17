# POS-entitlements-wizard-unification

**Estado:** IN_BUILD (revisión 2026-06-17 detectó gaps — ver §Reporte de Revisión)
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

## Criterios de Aceptación

- [ ] **AC1:** Existe un único componente `<EntitlementsWizardStep>` consumido por ambos wizards.
- [ ] **AC2:** `Onboarding` cliente NO escribe en `organization_modules` directamente — solo en `tenant_module_overrides`.
- [ ] **AC3:** Cliente Free intentando activar módulo Premium ve modal "Mejora tu plan" en vez de toggle exitoso.
- [ ] **AC4:** Tras cambiar plan en `TenantLicenseSection`, `tenant_module_overrides` queda limpio de keys no presentes en el nuevo plan (con confirmación).
- [ ] **AC5:** Trigger `trg_sync_organization_modules_from_entitlements` mantiene `organization_modules.enabled` consistente con `v_tenant_entitlements_modules.enabled`.
- [ ] **AC6:** `useEntitlements(orgId)` y cualquier lectura de `organization_modules` retornan el mismo conjunto enabled.
- [ ] **AC7:** Toda mutación de overrides invalida `queryKey: ['entitlements', orgId]` y registra entrada en `tenant_audit_log`.
- [ ] **AC8:** Test E2E: superadmin crea tenant Plan Pro → cliente entra a Onboarding → ve solo módulos Pro → desactiva uno → `resolve-entitlements` lo refleja en <2s.

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

- Borrar `organization_modules` (futura migración).
- Wizard de **límites** (`tenant_limit_overrides`) — solo módulos. Límites quedan en panel superadmin existente.
- Cambios al modelo de planes (`saas_plans`, `plan_modules`).
- Modificar `DomainWizard` (es de recursos, no entitlements).

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
