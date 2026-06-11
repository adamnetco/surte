---
name: SaaS Refactor Etapa 31 — Trusted Types report-only
description: Mitigación DOM-XSS — fase 1 (telemetría sin bloquear) antes de retirar 'unsafe-inline'
type: feature
---

# Etapa 31

## Cambio
`index.html` añade un segundo header **`Content-Security-Policy-Report-Only`**:

```
require-trusted-types-for 'script';
trusted-types default dompurify react react-dom tiptap lovable-sanitize 'allow-duplicates';
```

- **`require-trusted-types-for 'script'`**: cada asignación a un sink DOM-XSS (`innerHTML`, `outerHTML`, `eval`, `Function`, `setTimeout(string)`, etc.) genera una violación si no pasa por una policy registrada.
- **`trusted-types ... 'allow-duplicates'`**: lista las policies habituales que las libs intentarán registrar; permite duplicados (React StrictMode re-crea en dev).
- **Report-only**: no rompe nada. Las violaciones llegan al endpoint `csp-report` y se ven en `/superadmin/seguridad/csp`.

## Por qué report-only
- Trusted Types rompe `innerHTML` directos. Aunque el código limpio usa `sanitizeHtml.ts` (DOMPurify), libs third-party (Tiptap, GTM, terceros inyectados via `custom_scripts`) podrían disparar violaciones.
- 1-2 semanas de telemetría permiten:
  1. Identificar y envolver sinks legítimos con `trustedTypes.createPolicy()`.
  2. Listar policies reales en el directive.
  3. Migrar a enforcing en Etapa 33.

## Compatibilidad
- Soportado en Chromium (Chrome, Edge, Opera). Firefox/Safari ignoran el directive → no impacto negativo.
- Capturado por el listener `securitypolicyviolation` existente en `src/main.tsx` (Etapa 20). No requiere cambios en cliente.

## Próximo
- Etapa 32: rate-limit en DB (sliding window) para lead-capture / cart-sync / csp-report.
- Etapa 33: registrar `trustedTypes.createPolicy('lovable-sanitize', ...)` en `sanitizeHtml.ts` y pasar a enforcing.
