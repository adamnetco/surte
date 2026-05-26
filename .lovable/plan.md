
# Plan de Estabilización SistecPOS Core

Este plan está dividido en **5 fases independientes y aprobables por separado**. Cada fase tiene un alcance acotado para evitar regresiones masivas en un sistema en producción. Recomiendo aprobar fase por fase.

---

## FASE 0 — Reestructura de rutas y separación tenant semilla "surteya"

**Objetivo:** Que `/` deje de ser la tienda Surteya y se convierta en el portal de acceso al sistema SistecPOS.

**Cambios:**
- Nueva ruta `/` → `LoginRouter` que detecta tipo de acceso y redirige.
- `/admin/login` → acceso superadmin/admin (panel administrativo).
- `/user/login` → acceso cajero/cliente final.
- Todo el contenido actual de `/` (Hero, FeaturedProducts, Catálogo Surteya, etc.) se monta bajo `/surteya/*` o se sirve sólo cuando el subdominio resuelto es `surteya.*` o cuando `tenant_domains` lo determina así.
- `Index.tsx` se renombra a `SurteyaStorefront.tsx` y se enruta condicionalmente por tenant.
- Tras login, redirección por rol: superadmin → `/admin`, admin → `/admin`, cajero → `/pos`, cliente → `/mi/pedidos`.

**Archivos tocados:** `src/App.tsx`, `src/pages/Index.tsx` (rename), nuevo `src/pages/LoginRouter.tsx`, nuevo `src/pages/AdminLogin.tsx`, nuevo `src/pages/UserLogin.tsx`, ajuste en `src/lib/subdomain.ts`.

⚠️ **Riesgo alto** — afecta SEO y deep-links existentes de Surteya. Antes de ejecutar necesito confirmar:
1. ¿Surteya debe seguir accesible en producción durante la transición? (sugiero: sí, vía `surteya.sistecpos.com` o ruta `/surteya`).
2. ¿Mantener redirect 301 de `/producto/:slug` → `/surteya/producto/:slug`?

---

## FASE 1 — Seguridad: auditoría RLS y secretos

**RLS:**
- Script de auditoría que liste todas las tablas en `public` sin RLS o con policies `USING (true)`.
- Estandarizar tablas transaccionales (`orders`, `pos_orders`, `pos_order_items`, `pos_payments`, `cash_sessions`, `stock_movements`, `invoice_scans`, `purchase_orders`, etc.) al patrón:
  ```sql
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.can_write_org(organization_id))
  ```
  > Nota: la propuesta `current_setting('app.current_org_id')` requiere setear GUC en cada request — más frágil que las funciones `is_member_of`/`can_write_org` ya existentes y probadas. Recomiendo mantener estas funciones SECURITY DEFINER.

**Secretos:**
- Grep en `supabase/functions/**` buscando literales sospechosos (URLs hardcoded, tokens, keys).
- Reporte de hallazgos en `MIGRATION_LOG.md`.
- Los secretos ya configurados (RESEND_API_KEY, GOOGLE_PLACES_API_KEY, etc.) ya están en Vault — verificar uso vía `Deno.env.get()`.

**SSO:** revisión de `sso-issue` / `sso-consume` ya están endurecidos (nonce single-use, DELETE...RETURNING). Sólo añadir test E2E + log de auditoría en tabla `sso_audit` (nueva).

---

## FASE 2 — Resiliencia de sincronización

**Idempotencia:**
- `sync-products-to-wp`: añadir verificación por `wp_external_id` o hash de payload antes de POST.
- `send-ycloud-whatsapp`: verificar `message_idempotency_key` (usar `order_number + event_type`).
- `innapsis-emit`: ya usa `client_uuid`, validar que no se re-emita si `external_invoice_id` existe.

**Exponential backoff:**
- `sync-outbox-flush` **ya implementa** backoff [1, 5, 30, 120, 720] min. La propuesta del prompt (1s, 5s, 30s) es para reintentos in-process; el actual es para reintentos cross-job, que es lo correcto para una outbox persistente.
- Ajuste menor: añadir jitter (±20%) para evitar thundering herd.
- Estado `dead` ya existe → bien.

**Helper compartido:** `supabase/functions/_shared/syncLogger.ts` ya existe con `withRetry`. Migrar `sync-products-to-wp` y `send-ycloud-whatsapp` para que lo usen.

---

## FASE 3 — Observabilidad: SyncStatusTable + DLQ

**Componente nuevo:** `src/components/admin/SyncStatusTable.tsx`
- Consume `get_recent_sync_logs(_services, _limit)` (RPC ya existente).
- Realtime en `sync_logs` filtrado por `organization_id`.
- Columnas: servicio, estado (badge: success/error/pending/partial), última corrida, duración, intentos, último error (tooltip).
- Filtros por servicio y rango de tiempo.
- Skeleton consistente con resto del admin.

**Componente nuevo:** `src/components/admin/DeadLetterQueue.tsx`
- Consume `sync_outbox` con `status='dead'`.
- Acciones por fila: **Reintentar** (actualiza `status='pending'`, `next_attempt_at=now()`, `attempts=0`), **Ver payload** (modal JSON), **Descartar**.
- Edge function nueva `sync-outbox-retry` para reset atómico.

**Integración:** nueva tab "Sincronización" en `AdminDashboard.tsx`.

---

## FASE 4 — Estabilidad UI: ErrorBoundary + Skeletons

**ErrorBoundary:**
- `src/components/pos/POSErrorBoundary.tsx` envolviendo `POSWorkspace`.
- Persiste el ticket actual en `localStorage` (`pos_ticket_recovery:${cash_session_id}`) en cada cambio.
- Fallback UI con: "Ocurrió un error. Tu ticket está guardado." + botón "Recuperar y continuar" + botón "Reportar incidente" (insert en `error_reports`).

**Skeletons:**
- Auditoría rápida: identificar componentes que usan `useQuery`/`useEffect` sin skeleton.
- Crear `src/components/ui/skeleton-presets.tsx` con presets: `TableSkeleton`, `CardGridSkeleton`, `FormSkeleton`.
- Aplicar en: `AdminDashboard`, `SyncStatusTable`, `POSWorkspace` (carga inicial de catálogo), `Inventario`, `MisPedidos`.

---

## FASE 5 — Documentación: MIGRATION_LOG.md + views-map.md

**MIGRATION_LOG.md:**
- Snapshot del esquema final post-fases (tablas, columnas clave, RLS activas).
- Tabla de servicios de sync con: nombre, idempotencia, backoff, dead-letter, dashboard.
- Estado de subdominios y SSO.

**docs/views-map.md** (actualizar):
- Mapa completo de las 4 áreas (Admin / POS / Mi / KDS) con jerarquía de rutas, componentes principales, RPCs consumidas y permisos requeridos.
- Incluye los referentes de competencia (Alegra, Bsale, Eleventa) por pantalla como guía de diseño.

---

## Detalles técnicos relevantes

```text
Dependencias entre fases:
  Fase 0 ──┐
           ├── independientes
  Fase 1 ──┤
  Fase 2 ──┤
  Fase 3 ──┴── depende de Fase 2 (sync-outbox-retry)
  Fase 4 ── independiente
  Fase 5 ── al final
```

**Migraciones DB necesarias:**
- Fase 1: posiblemente nuevas policies en tablas sin RLS (a determinar tras auditoría).
- Fase 3: tabla nueva `error_reports` (opcional), índice en `sync_outbox(status, next_attempt_at)`.

**Sin cambios destructivos** previstos. Toda alteración de RLS será aditiva (revisión + estandarización, no DROP).

---

## Pregunta clave antes de empezar

**¿Por dónde empezamos?** Recomiendo este orden por impacto/riesgo:

1. **Fase 4** (ErrorBoundary) — máxima estabilidad, cero riesgo. **30 min.**
2. **Fase 3** (Dashboard sync + DLQ) — observabilidad inmediata. **1-2 h.**
3. **Fase 2** (Idempotencia + jitter) — resiliencia. **1 h.**
4. **Fase 1** (Auditoría RLS) — requiere revisión cuidadosa. **2-3 h.**
5. **Fase 0** (Reestructura `/` → login) — alto riesgo SEO, dejar al final con plan de redirects. **2 h + QA.**
6. **Fase 5** (Docs) — al cierre.

Confirma con qué fase quieres que arranque y respondo las preguntas abiertas (Surteya en `/surteya` vs subdominio, mantener policies actuales vs migrar a `app.current_org_id`, etc.).
