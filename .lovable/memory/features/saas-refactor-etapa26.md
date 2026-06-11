---
name: SaaS Refactor Etapa 26 — Validación estricta lead-capture (Zod)
description: Defensa de input boundary en endpoint público lead-capture (sin rate-limit por falta de primitiva backend)
type: feature
---

# Etapa 26

## Contexto
- Originalmente planificada como "rate-limit en lead-capture/cart-sync".
- El backend NO tiene una primitiva estándar de rate-limit (documentado en plataforma). Findings que pidan rate-limit se ignoran hasta que exista infraestructura.
- Pivote: reforzar la validación de input en el endpoint público `lead-capture` (defensa en profundidad contra payloads abusivos / inyección / overflow).

## Cambios
- `lead-capture/index.ts`: schema Zod completo (`LeadSchema`) con:
  - `full_name` 2-200 chars, sanitizado (strip control chars).
  - `email` validado con `z.string().email()` y máx 254 chars (RFC 5321).
  - `phone` máx 30 chars.
  - `business_name/type`, `city`, `source`, `source_page`, `plan_interest`, `message` con límites estrictos.
  - `modules_interest`: array máx 30 items.
  - `utm`: record con keys y values acotados.
  - `refine` para exigir email O phone.
- Respuesta `400` con `{ error: "validation_error", details: <flatten> }` ante input inválido.

## No incluido
- Rate-limit (gap conocido de plataforma).
- Captcha (a evaluar cuando se conecte tráfico real).

## Próximo
- Etapa 27 candidata: aplicar misma disciplina Zod a `cart-sync`, `send-callmebot`, `send-ycloud-whatsapp`.
- Etapa 28: endurecer allowlist CSP a hosts específicos (reemplazar `https:` por dominios).
