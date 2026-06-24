---
name: WhatsApp Message Events
description: Per-message WhatsApp delivery tracking (queued, sent, delivered, read, failed, retry_requested) shown in /pedido/:orderNumber
type: feature
---

# WhatsApp Message Events

Table `public.whatsapp_message_events` stores per-message WhatsApp delivery status linked to `orders.id` and `whatsapp_ref`.

## Schema
- order_id (uuid, FK orders, cascade)
- whatsapp_ref (text, provider message id)
- status: queued | sent | delivered | read | failed | retry_requested
- error (text, nullable)
- payload (jsonb, raw provider event)
- created_at

Public SELECT (order tracking page is public). Service-role-only INSERT. Realtime enabled.

## Edge functions
- `whatsapp-status-webhook` (verify_jwt=false): YCloud + Cloud API normalizer. Maps `accepted/queued→queued`, `sent`, `delivered`, `read`, `failed/undelivered/error→failed`. Backfills `order_id` by joining `whatsapp_ref`.
- `resend-whatsapp-order` (verify_jwt=false): public retry endpoint. Rate-limited to 3 retries per order per 10 min. Inserts `retry_requested`, calls `send-ycloud-whatsapp` with service-role bearer, logs `sent` or `failed`.

## UI: /pedido/:orderNumber
- Historial unifica milestones del pedido + eventos WhatsApp.
- Realtime: canal `order-{id}` escucha UPDATE orders + INSERT whatsapp_message_events.
- Botón "Reenviar WA" con `window.confirm`, deshabilitado durante reintento o si último estado es `delivered`/`read`.
- Skeleton mientras carga; estado vacío; estado de error con reintento; paginación "Ver más" cada 20.
- Errores del webhook se muestran inline bajo el evento `failed`.

## Provider webhook configuration
Apunta el webhook YCloud a:
`https://{PROJECT}.functions.supabase.co/whatsapp-status-webhook`
