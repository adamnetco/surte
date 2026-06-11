---
name: SaaS Refactor Etapa 20
description: Telemetría CSP — tabla csp_violations + edge function csp-report + listener cliente
type: feature
---

# Etapa 20 — Telemetría CSP

## Objetivo
Recolectar datos reales de violaciones CSP (modo report-only de Etapa 18) antes de endurecer a enforcing en una etapa posterior.

## Cambios
- **DB**: tabla `public.csp_violations` (documento, directiva violada, blocked URI, source/line, raw payload, organization_id opcional). RLS: anon/auth pueden INSERT (lo envía el navegador); solo superadmin SELECT.
- **Edge function `csp-report`**: endpoint público (anon) que persiste el payload. Acepta formato `SecurityPolicyViolationEvent` y `csp-report` clásico.
- **Cliente `src/main.tsx`**: listener `securitypolicyviolation` con dedupe in-memory (200 keys) que usa `navigator.sendBeacon` para enviar al endpoint sin bloquear el render.

## Por qué no `report-uri` directo
La directiva `report-uri` no es aplicable cuando el CSP se declara en `<meta http-equiv>` (los browsers lo ignoran). El listener cliente es el workaround estándar mientras no se mueva el header CSP al servidor.

## Próximo paso (Etapa 21)
- Revisar `csp_violations` durante 24-48h.
- Ajustar `script-src`/`connect-src` para listar dominios reales.
- Mover CSP a header HTTP via meta refresh server-side o convertir a `Content-Security-Policy` enforcing.

## Notas de rate-limiting
Plataforma no tiene primitiva de rate-limit nativa (ver `<no-backend-rate-limiting>`). El dedupe in-memory en cliente + naturaleza del tráfico de violaciones (baja por sesión) hace innecesario uno server-side ahora.
