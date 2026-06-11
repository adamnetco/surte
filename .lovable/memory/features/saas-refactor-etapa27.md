---
name: SaaS Refactor Etapa 27 — Zod estricto en cart-sync y WhatsApp
description: Validación de payloads con Zod en cart-sync, send-ycloud-whatsapp y send-callmebot
type: feature
---

# Etapa 27

## Cambios
- `cart-sync/index.ts`: schemas `Uuid`, `CartItem`, `PostSchema`, `PatchSchema` (discriminados por método). Reemplaza el isUuid regex y los `Number(...)` defensivos por validación tipada con caps (items max 500, qty max 9999, subtotal max 1e10).
- `send-ycloud-whatsapp/index.ts`: `z.discriminatedUnion("action", ...)` con `SendOrderSchema | SendTemplateSchema | SendTextSchema | CheckBalanceSchema`. Valida `to` con regex de teléfono, caps de items, mensaje max 4000 chars, template_name max 120.
- `send-callmebot/index.ts`: `PayloadSchema` valida `phone`, `message` (1-2000), `apikey`, `organization_id`.

## Respuesta de error estándar
`400 { error: "invalid_payload", details: <z.flatten> }` — front puede mostrar mensajes por campo.

## Próximo
- Etapa 28: endurecer CSP a hosts específicos.
