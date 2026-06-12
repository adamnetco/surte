# POS-MejoraLoginModerno

**Estado:** IN_REVIEW
**Módulo:** auth
**Owner:** —

## Problema
La pantalla `/admin/login` (LoginRouter) tenía inputs sin `htmlFor`/`id`, sin `aria-live` para errores, sin estado `aria-busy` en el submit y sin foco visible consistente. Mobile-first OK pero faltaba pulir touch targets y feedback de carga.

## Criterios de Aceptación
- [x] **AC1**: Todos los inputs (tienda, email, password) tienen `<label htmlFor>` enlazado al `id` del input. (`LoginRouter.tsx`)
- [x] **AC2**: Errores y avisos (`emailNotice`, banner backend-down) usan `role="alert"` + `aria-live="polite"`.
- [x] **AC3**: Botones de submit, magic-link y Google tienen `aria-busy` y `aria-disabled` reflejando el estado de carga.
- [x] **AC4**: Anillo de foco visible (`focus-visible:ring-2 ring-primary/60`) en todos los inputs y botones.
- [x] **AC5**: Touch targets ≥ 44×44 px en mobile (`min-h-11`).
- [x] **AC6**: `/auth-status` y `/admin/auth-status` redirigen a `/` para cualquier usuario que no sea el superadmin maestro (`MasterOnlyGuard`). E2E: `e2e/auth-status-guard.spec.ts`.
- [x] **AC7**: El link "Recuperar acceso" del LoginRouter navega a `/reset-password?tienda=<slug>` preservando el slug. E2E: `e2e/login-recovery-link.spec.ts`.

## Notas de Implementación
- Mantener paleta dark `slate-950` existente (consistencia con resto del onboarding multi-tenant).
- No mover lógica: solo presentación/a11y.
- Publicación: requiere clic manual en "Update" del diálogo Publish para que el frontend salga a producción.
