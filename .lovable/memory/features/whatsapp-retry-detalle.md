---
name: WhatsApp Retry Detallado + Test Fixtures
description: Reintentos de WA con actor/reason/attempt en payload, edge function de fixtures para QA y E2E con vitest del timeline en /pedido/:orderNumber
type: feature
---

# WhatsApp Retry detallado y Test Fixtures

## Retry con metadata
`resend-whatsapp-order` ahora acepta:
- `reason` (string, ≤240 chars)
- `actor_id`, `actor_name`
- Calcula `attempt` (1..3) a partir de los `retry_requested` últimos 10min.
- Persiste todo en `whatsapp_message_events.payload`:
  ```json
  { "source":"pedido_page","attempt":2,"reason":"No llegó","actor_id":"u-1","actor_name":"tester@x.com","requested_at":"..." }
  ```
- El evento `sent` resultante incluye `retry_of` con el payload original para trazabilidad.

UI (`Pedido.tsx`): prompt nativo pide motivo; cancela si el usuario aborta. El timeline muestra una línea meta debajo del label: `intento #2 · por X · motivo: "..."`.

## Test fixtures (`whatsapp-status-fixture`)
Edge function pública pero protegida por `x-test-token` == env `WHATSAPP_TEST_TOKEN`. Si la env no existe → 403 (cerrada en prod).

Body:
```json
{ "order_number": 1234, "events": [
  { "status":"sent" }, { "status":"delivered", "delay_ms":500 },
  { "status":"read" }, { "status":"failed", "error":"30005" }
]}
```
Inserta directamente en `whatsapp_message_events` resolviendo `order_id` por `order_number`. Permite probar QA E2E sin disparar YCloud real.

## Vitest E2E (`Pedido.test.tsx`)
Mockea `@/integrations/supabase/client` (queries, Realtime, functions.invoke) y verifica:
1. Render base + bloque Historial.
2. Detalle de reintento (`attempt/actor/reason`).
3. Refresco manual recarga eventos.
4. Paginación `Ver más` + skeleton.
5. Realtime: callback de canal dispara refetch y muestra estado nuevo.

## UI: virtualización ligera del timeline
- Agrupación por día (sticky day header) para escaneo rápido en mobile.
- `loadMore` con skeleton 150ms para feedback al paginar.
- Mantiene `TIMELINE_PAGE=20` y query limit subido a 500.
