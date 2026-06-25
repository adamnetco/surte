
# Plan maestro — Onboarding SaaS, diagnóstico y trazas

Trabajo encolado en **5 fases secuenciales**. Cada fase es un turno independiente; al terminar te muestro resultado y pides la siguiente.

---

## Fase 1 — Auditoría UX end-to-end (informe, sin código)

**Entregable:** `docs/audit/onboarding-2026-06.md`

- Recorro con Playwright en preview el flujo real: signup → crear tenant → seleccionar plan → primer ingreso a `/pos`.
- Capturo screenshots por paso (mobile 390px + desktop 1280px).
- Para cada pantalla documento: qué pasa, fricción detectada, qué hace la industria (Stripe Atlas, Linear, Vercel, Square, Toast, Shopify), propuesta concreta.
- Matriz priorizada (Impact × Effort) de los 10-15 hallazgos.
- Wireframes ASCII del nuevo flujo propuesto en 4-5 pasos guiados.

**Verificación:** screenshots en `/mnt/documents/audit/` + informe legible.

---

## Fase 2 — Rediseño onboarding (implementación)

**Entregable:** wizard guiado nuevo en `src/modules/onboarding/`

Estructura propuesta (sujeta a hallazgos Fase 1):

```text
/onboarding
  step-1-business     → nombre, tipo (retail/food/hybrid/services), ciudad
  step-2-branding     → logo, color, subdomain (con validación live)
  step-3-plan         → grid 4 planes con highlight "Recomendado"
  step-4-team         → invitar (opcional, skip)
  step-5-ready        → checklist primer uso + CTA "Ir al POS"
```

- Progress bar persistente, "Guardar y continuar" en cada paso.
- Estado en `onboarding_progress` (tabla ya existe).
- Redirect inteligente: si onboarding incompleto → reanuda en último paso.
- Empty states ilustrados, microcopys cálidos, atajos de teclado.
- Mobile-first 390px, desktop split 50/50 (form + preview live).

**Verificación:** Playwright recorre los 5 pasos sin errores; smoke test crea tenant + plan + entra al POS.

---

## Fase 3 — Smoke tests + diagnóstico RLS

**Entregables:**
1. `tests/e2e/planes-smoke.spec.ts` — verifica que `/planes` muestra los 4 planes públicos (Free, Pro, Business, Enterprise) en Live.
2. `src/modules/superadmin/pages/DiagnosticoRLS.tsx` — nueva ruta `/superadmin/diagnostico` que muestra:
   - Tabla con: nombre tabla, RLS habilitado (sí/no), GRANTs por rol (anon/authenticated/service_role), nº de policies.
   - Filtro rápido "solo tablas con problemas".
   - Botón "Re-verificar" que ejecuta query contra `information_schema`.
   - Edge function `rls-audit` que retorna JSON con el diagnóstico (service_role).

**Verificación:** smoke test pasa en CI; página `/superadmin/diagnostico` lista correctamente `saas_plans` con GRANTs OK.

---

## Fase 4 — Trazas WhatsApp + alertas RLS

**Entregables:**
1. Logs estructurados en `whatsapp-inbound` y outbound:
   - Cada evento: `{ org_id, phone, message_id, direction, status, latency_ms, error? }`.
   - Persiste en `whatsapp_message_events` (ya existe).
   - Helper `logWhatsAppEvent()` reutilizable.
2. Alertas:
   - Trigger DB que inserta en `health_events` si una query a `saas_plans` retorna 0 filas con `is_public=true` (señal de GRANT/RLS roto).
   - Vista `/superadmin/health` muestra los `health_events` recientes.

**Verificación:** enviar mensaje de prueba → aparece en `whatsapp_message_events`; revocar GRANT temporal en Test → alerta se dispara.

---

## Fase 5 — Consolidación RLS `saas_plans` + cierre

- Review de las policies actuales de `saas_plans` (ya hay `plans_public_read` + `plans_superadmin_write`).
- Migración idempotente que garantiza: solo SELECT público si `is_public=true`, sin INSERT/UPDATE/DELETE para anon/authenticated.
- Test de regresión: usuario anon puede leer planes públicos, no puede escribir.
- Resumen final con todo lo entregado y siguientes pasos sugeridos.

---

## Para arrancar

Apruebo este plan y empiezo **Fase 1 (auditoría con Playwright)** en el siguiente turno. Cada fase la entrego completa antes de pasar a la siguiente — tú confirmas y avanzo.
