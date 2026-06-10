# Plan — Health Observability, Tenant Provisioning E2E y UX de Activación

Este plan cubre 5 frentes solicitados. Se puede ejecutar por fases independientes; recomiendo el orden listado.

---

## Fase 1 — Verificación E2E del aprovisionamiento de subdominio (.sistecpos.com)

**Objetivo:** garantizar que al crear una tienda quede `<slug>.sistecpos.com` con DNS + SSL emitido y visible en la UI.

**Backend**
- `tenant-create-with-owner`: confirmar que llama a `cloudflare-domain-connect` y persiste `tenant_domains.cloudflare_hostname_id`, `ssl_status='pending_validation'`.
- Nueva edge function `tenant-provision-verify` (idempotente): recibe `organization_id`, refresca SSL via Cloudflare API, actualiza `tenant_domains.ssl_status` + `last_checked_at`. Reusa lógica de `cloudflare-domain-status`.
- Tests Deno: `tenant-create-with-owner.test.ts` valida que tras crear org se inserta `tenant_sites` + `tenant_domains` con hostname `slug.sistecpos.com`.

**Frontend**
- `SiteDetailsPanel.tsx`: añadir bloque "Aprovisionamiento" con 3 chips: DNS (CNAME OK / pendiente), SSL (issued / pending / failed), Cloudflare hostname id.
- Botón "Reintentar verificación" → invoca `tenant-provision-verify`.
- Polling cada 30s mientras `ssl_status !== 'active'`, máximo 10 min, luego detener y mostrar acción manual.

---

## Fase 2 — Timeline de salud en la barra de estado

**Objetivo:** auditar cambios de estado (printer/core/wp) con historial inspeccionable.

**Cliente (sin persistencia adicional)**
- Nuevo `src/modules/pos/lib/healthTimeline.ts`: ring buffer en memoria (últimos 200 eventos) + espejo en `sessionStorage` (`__sistecpos_health_timeline__`).
- API: `recordHealthEvent({ source, prevStatus, status, latency_ms, message, correlationId })`.
- En `useHealthSnapshot.ts`: comparar snapshot anterior vs nuevo; si cambia status de core/wp → record.
- En `POSStatusBar.tsx` (printer): record en cada cambio de estado.
- Genera `correlationId` (crypto.randomUUID()) por cada request snapshot y se propaga al `health-snapshot` via header `x-correlation-id` y se devuelve.

**UI**
- `StatusPill.tsx`: nueva sección "Historial reciente" en el Popover con últimos 5 eventos del source (ícono según severidad, hora relativa, correlationId truncado copiable).
- Componente nuevo `HealthTimelineSheet.tsx`: Sheet completo con filtros por source/status y export CSV. Trigger desde un botón "Ver historial completo" al final del popover.

---

## Fase 3 — Panel de logs en Admin

**Objetivo:** centralizar eventos de salud con correlationId para investigación.

**Backend**
- Migración: tabla `health_events` (organization_id, source, status, prev_status, latency_ms, message, correlation_id, metadata jsonb, created_at). RLS: admin/owner pueden leer; service_role insert. GRANTs explícitos.
- Edge function `health-snapshot`: además de devolver snapshot, hace insert async (fire-and-forget) en `health_events` cuando detecta cambio de estado vs último registro.
- Edge function `printer-event-log` (nueva): cliente reporta eventos de impresora.

**Frontend**
- Nueva página `src/modules/admin-cms/pages/HealthLogs.tsx` accesible desde Configuración → Logs de sistema.
- Tabla virtualizada (TanStack) con columnas: fecha, source (chip), estado (prev→new), latencia, mensaje, correlationId (copiable), acciones (ver metadata json en Sheet).
- Filtros: rango de fechas, source, status. Búsqueda por correlationId.
- Realtime: suscripción a `health_events` para nuevos eventos en vivo.

---

## Fase 4 — Tests automatizados de accesibilidad

**Objetivo:** asegurar a11y en POSStatusBar y grid de Sitios en cada PR.

**Setup**
- Añadir `vitest-axe` + `@axe-core/react` a devDependencies.
- `src/test/a11y.ts` helper: `expectNoA11yViolations(container)`.

**Tests**
- `src/modules/pos/components/POSStatusBar.test.tsx`: render con mock de `useHealthSnapshot` (3 escenarios: ok, degraded, off) → axe + foco visible (tab navega entre pills) + aria-label presente.
- `src/modules/superadmin/pages/Sitios.test.tsx`: render con mock de sitios (vacío, 1, varios) → axe + roles `article` + botones icon-only con `aria-label`.
- `StatusPill.test.tsx`: contraste de tokens (verificar clases `text-foreground` no arbitrarias) + popover navegable por teclado (Escape cierra).

**CI**
- Añadir job `a11y` en `.github/workflows/e2e.yml` que ejecute `bunx vitest run --reporter=verbose **/*.a11y.test.tsx`.

---

## Fase 5 — UX del flujo Licencia → Onboarding → POS (clave para el usuario)

**Problema reportado:** "al crear licencia empieza onboarding, pero al ingresar a crear tienda sale 'módulo POS no activo'."

**Diagnóstico previsto:**
- La licencia se crea pero `organization_modules` no incluye `pos` automáticamente, o `OrganizationContext` no refresca tras el wizard.
- Falta feedback de estado: el usuario no sabe en qué paso está bloqueado.

**Cambios**

**5.1 — Activación automática del módulo POS**
- En `tenant-create-with-owner`: garantizar insert en `organization_modules` con los módulos seleccionados en el wizard (`pos` siempre incluido si la plantilla lo trae).
- Trigger SQL `trg_license_activate_default_modules`: al insertar licencia activa, si no hay `organization_modules` para esa org, insertar los del `saas_plan.plan_modules`.

**5.2 — Pantalla de estado de activación (`/activacion`)**
- Nueva ruta + componente `ActivationStatus.tsx` (módulo onboarding).
- Stepper visual con 5 hitos:
  1. Cuenta creada ✓
  2. Licencia activa (con plan)
  3. Tienda configurada (slug, NIT)
  4. Módulos activos (lista con check por módulo)
  5. Subdominio + SSL listo (lee `tenant_domains.ssl_status`)
- Cada paso pendiente muestra CTA: "Continuar onboarding", "Activar módulo POS", "Reintentar SSL".
- Botón "Ir al POS" se habilita solo cuando 1-4 están completos; muestra warning si 5 pendiente pero no bloquea.

**5.3 — Guardia mejorada de "módulo POS no activo"**
- Actualmente probablemente se muestra un texto seco. Reemplazar por componente `ModuleInactiveScreen.tsx`:
  - Icono + título claro: "El módulo POS aún no está activo en esta tienda."
  - Diagnóstico: lista qué falta (licencia, plan, módulo) leyendo de BD.
  - 2 CTAs: "Ver estado de activación" (→ `/activacion`) y "Contactar soporte" (WhatsApp).
  - Breadcrumb arriba: `Tiendas › <nombre> › POS (inactivo)`.

**5.4 — Breadcrumbs + botones de retorno globales en flujo onboarding/admin**
- Nuevo componente `src/components/AppBreadcrumb.tsx` que consume `useLocation` y un mapa de rutas a labels (define en `src/lib/routeLabels.ts`).
- Integrar en headers de: `PosHub`, `Sitios`, `TenantWorkspace`, `ActivationStatus`, `Onboarding`, `Billing`, `HealthLogs`.
- Cada página con `<AppBreadcrumb />` + botón "Volver" (flecha) que use `navigate(-1)` con fallback a la ruta padre.

**5.5 — Guía contextual (tour ligero)**
- Componente `OnboardingChecklist.tsx`: chip flotante (bottom-right) visible para owners con onboarding incompleto, abre Popover con los 5 hitos de 5.2 en miniatura. Cierra y recuerda en `localStorage` cuando todo completo.

---

## Técnicas / archivos clave

```
Backend
  supabase/functions/tenant-provision-verify/index.ts    (nuevo)
  supabase/functions/health-snapshot/index.ts            (insert health_events)
  supabase/functions/printer-event-log/index.ts          (nuevo)
  supabase/functions/tenant-create-with-owner/index.ts   (asegurar organization_modules)
  Migración: health_events + trigger trg_license_activate_default_modules

Frontend
  src/modules/pos/lib/healthTimeline.ts                  (nuevo)
  src/modules/pos/components/HealthTimelineSheet.tsx     (nuevo)
  src/modules/pos/components/StatusPill.tsx              (timeline en popover)
  src/modules/pos/hooks/useHealthSnapshot.ts             (correlationId + diff)
  src/modules/superadmin/components/SiteDetailsPanel.tsx (bloque SSL)
  src/modules/admin-cms/pages/HealthLogs.tsx             (nuevo)
  src/modules/onboarding/pages/ActivationStatus.tsx      (nuevo)
  src/modules/onboarding/components/OnboardingChecklist.tsx (nuevo)
  src/components/AppBreadcrumb.tsx                       (nuevo)
  src/components/ModuleInactiveScreen.tsx                (nuevo)
  src/lib/routeLabels.ts                                 (nuevo)

Tests
  vitest-axe setup + a11y helpers
  POSStatusBar.a11y.test.tsx, Sitios.a11y.test.tsx, StatusPill.a11y.test.tsx
  tenant-create-with-owner.test.ts
```

---

## Verificación final

- Crear tienda nueva desde wizard → ver `<slug>.sistecpos.com` en SiteDetailsPanel con SSL pasando de pending → active en <5min.
- Acceder al POS de la nueva tienda como owner → módulo POS activo sin pantalla "no activo".
- Forzar fallo de printer agent → ver evento en timeline del pill + fila en HealthLogs con correlationId.
- `bunx vitest run` con suite a11y en verde.
- Lighthouse a11y ≥ 95 en /pos/vender, /sitios, /admin/health-logs.

---

## Orden recomendado

1. Fase 5.1 + 5.3 (desbloqueo inmediato del usuario)
2. Fase 1 (verificación SSL)
3. Fase 5.2 + 5.4 + 5.5 (UX guiada)
4. Fase 3 (panel logs) + Fase 2 (timeline en pills)
5. Fase 4 (tests a11y) como red de seguridad final

¿Apruebas el plan completo, o prefieres que arranque solo por la Fase 5 (desbloqueo POS + breadcrumbs) primero?
