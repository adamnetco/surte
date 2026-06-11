---
name: SaaS Refactor Etapa 18
description: sync-outbox-retry tenant scope + CSP report-only + E2E ampliado
type: feature
---

# Etapa 18 — Hardening adicional

## 1. `sync-outbox-retry`
- Antes: solo exigía JWT válido. Cualquier usuario logueado podía resetear filas de otra org.
- Ahora: carga la fila, lee su `organization_id`, valida que el caller sea owner/admin activo de esa org (o `superadmin` master via `has_role`).
- Filas legacy sin `organization_id` solo las puede tocar superadmin master.

## 2. CSP Report-Only
- `index.html` ahora envía `Content-Security-Policy-Report-Only` permisiva (default-src self+https+data+blob, script-src con unsafe-inline/eval, frame-ancestors self) para observar violaciones sin romper assets externos.
- Próximo paso: revisar violaciones en consola y endurecer a `Content-Security-Policy` enforcing (quitar unsafe-eval, listar dominios específicos para connect-src).

## 3. E2E ampliado (`scripts/e2e-tenant-isolation.ts`)
- Nuevos casos cross-tenant:
  - `broadcast-whatsapp-ycloud` con `organization_id` de la otra org → debe rechazar.
  - `sync-outbox-retry` con id de fila de otra org → debe rechazar (403/forbidden).
- Mantiene los 16 SELECT cross-org + send-web-push previos.

## Estado SaaS
- 18 etapas: aislamiento multi-tenant cubierto en DB (RLS+grants), CMS, POS, storefront, edge functions (send-web-push, sync-order, broadcast-whatsapp-ycloud, sync-outbox-retry) y perf indexes.
- CSP en modo observación.
- Próximos candidatos: billing por org, audit de logs de seguridad, endurecer CSP a enforcing.
