
# Consolidación SistecPOS Core — Plan de ejecución

## Estado actual detectado

Mucho de lo solicitado **ya existe** en el repo. Antes de tocar nada, este es el inventario real:

| Pieza pedida | Estado actual |
|---|---|
| `sync-products-to-wp` edge function | ✅ Existe en `supabase/functions/sync-products-to-wp` |
| `sync-order` edge function | ✅ Existe en `supabase/functions/sync-order` |
| `wp-revalidate-webhook` edge function | ✅ Existe (`verify_jwt=false`, sin shared secret) |
| Tabla `profiles` extendiendo `auth.users` | ✅ Existe + trigger `handle_new_user` |
| Enum `app_role` | ✅ Existe: `admin, user, superadmin, editor, agente`. ⚠️ Falta `cashier` (el brief pide `admin/cashier/agente`) |
| `broadcast-whatsapp-ycloud` | ✅ Existe como broadcast manual; **no** se dispara automáticamente al confirmar pedido |
| Templates `order-confirmation`, `registry` | ✅ Existen en `_shared/transactional-email-templates/` y están registrados |
| `cost_price` calculado si no se provee | ❌ No hay trigger; hoy queda `NULL` |
| Cash Denominations para cierre de caja | ❌ No existe tabla ni UI |
| `MIGRATION_LOG.md` por servicios | ⚠️ Existe pero solo registra fases de tablas |
| Outbox de reintentos para sync WP | ❌ No existe; los fallos se pierden |

Por tanto el trabajo real se concentra en **6 entregables**, no en reescribir lo que ya funciona.

---

## Entregables

### 1. Hardening del webhook de WordPress
- Añadir secreto `WP_REVALIDATE_SECRET` (runtime secret, no Vault — Vault es para uso server-side en SQL, aquí lo usa una edge function).
- `wp-revalidate-webhook` valida header `X-Sistecpos-Signature` (HMAC SHA-256 del body con el secreto) y rechaza con 401 si no coincide.
- Mantener `verify_jwt = false` (es webhook público) pero ahora autenticado por firma.

### 2. Outbox de sincronización resiliente
Nueva tabla `public.sync_outbox`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `target` | text | `wp_product`, `wp_order`, `wp_revalidate` |
| `payload` | jsonb | Body listo para reenviar |
| `attempts` | int | default 0 |
| `last_error` | text | |
| `next_attempt_at` | timestamptz | backoff exponencial |
| `status` | text | `pending`, `succeeded`, `dead` |
| `organization_id` | uuid | |
| `created_at` / `updated_at` | | |

- RLS: solo `service_role` y miembros de la org pueden leer; escritura solo `service_role`.
- `sync-products-to-wp` y `sync-order` se modifican: si la llamada HTTP a WP falla → `INSERT` en `sync_outbox` con backoff = 1, 5, 30, 120 min, max 5 intentos antes de `dead`.
- Nueva edge function `sync-outbox-flush` que procesa pendientes vencidos.
- `pg_cron` cada 2 min llama a `sync-outbox-flush`.

### 3. Rol `cashier` + RLS de escritura org-scoped
- `ALTER TYPE app_role ADD VALUE 'cashier'`.
- Helper SQL `can_write_org(_org_id uuid)` que devuelve `true` solo si el usuario es `superadmin` global **o** miembro de la org con rol `admin`/`cashier`.
- Auditoría: aplicar la nueva regla a `pos_orders`, `pos_payments`, `cash_sessions`, `cash_movements` (tablas operativas de caja).
- **No** se tocan políticas de catálogo (`products`, `categories`) — esas ya tienen su esquema admin/editor consolidado.

### 4. WhatsApp automático en `orders.status = 'confirmed'`
- Trigger `AFTER UPDATE ON public.orders` que, cuando `OLD.status <> 'confirmed' AND NEW.status = 'confirmed'`, llama vía `pg_net.http_post` a la edge function `send-whatsapp-order` (ya existe) con el `order_id`.
- La función ya formatea el mensaje WhatsApp; solo le pasamos el id y ella resuelve el resto.
- Log de cada disparo en `sync_outbox` para reintento si `pg_net` reporta fallo.

### 5. `cost_price` con fallback calculado
- Trigger `BEFORE INSERT OR UPDATE` en `products`: si `cost_price IS NULL`, lo calcula como `round(price * 0.65, 2)` (margen 35% por defecto). Configurable vía `app_settings.key = 'default_cost_margin'`.
- No sobreescribe valores existentes; solo rellena cuando viene vacío.

### 6. Cash Denominations para cierre de caja
Nuevas tablas:
- `cash_denominations` — catálogo (valor en COP: 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000) con `is_active` y `sort_order`.
- `cash_session_counts` — conteo por denominación al cerrar caja: `session_id`, `denomination_id`, `quantity`, `kind` (`open`/`close`).
- RPC `close_cash_session_with_counts(_session_id uuid, _counts jsonb)` que calcula el total contado, lo compara con `expected_amount` y guarda `difference` en `cash_sessions`.
- Seed inicial de denominaciones COP.

### 7. `MIGRATION_LOG.md` por servicios
Añadir sección final **"Estado de servicios"** con tabla viva:

```
| Servicio              | Estado  | Última verificación | Notas               |
|-----------------------|---------|---------------------|---------------------|
| Sync WP (productos)   | activo  | YYYY-MM-DD          | outbox + HMAC       |
| Sync WP (pedidos)     | activo  | YYYY-MM-DD          | outbox              |
| WP Revalidate webhook | activo  | YYYY-MM-DD          | HMAC requerido      |
| WhatsApp on confirmed | activo  | YYYY-MM-DD          | trigger DB → pg_net |
| Email transaccional   | activo  | YYYY-MM-DD          | pgmq queue          |
| SSO handoff           | activo  | YYYY-MM-DD          | one-shot 60s + cron |
```

---

## Detalles técnicos

- **Secrets nuevos**: `WP_REVALIDATE_SECRET` (lo pediremos vía `add_secret` cuando el usuario apruebe el plan).
- **Migrations**: 4 archivos separados — (a) `sync_outbox` + RLS, (b) `cashier` enum + helper + RLS, (c) trigger WhatsApp en `orders`, (d) `cost_price` trigger + `cash_denominations`/`cash_session_counts` + RPC + seed.
- **Edge functions nuevas**: `sync-outbox-flush`. Modificadas: `wp-revalidate-webhook` (HMAC), `sync-products-to-wp` y `sync-order` (escribir en outbox al fallar).
- **pg_cron**: job `sync-outbox-flush-2min` cada 2 minutos.
- **No se toca**: arquitectura SSO/global logout (recién consolidada), email queue, catálogo público.

## Lo que queda fuera de este plan (a pedir explícito si lo necesitas)

- Reescritura del UI de cierre de caja para usar las nuevas denominaciones (puedo hacerlo en una segunda iteración; aquí solo dejo el backend listo).
- Conmutación de `broadcast-whatsapp-ycloud` masivo a YCloud Business API real (hoy usa wa.me fallback).
- Sincronización inversa WP → Supabase (este plan es solo Supabase → WP).

---

¿Apruebas? Si dices que sí, ejecuto en este orden: (1) migración outbox + cashier + cash denominations + cost_price + WhatsApp trigger en una sola tanda, (2) `add_secret` para `WP_REVALIDATE_SECRET`, (3) edge functions modificadas + nueva `sync-outbox-flush`, (4) cron job, (5) update de `MIGRATION_LOG.md`.
