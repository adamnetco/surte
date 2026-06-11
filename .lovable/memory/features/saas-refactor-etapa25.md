---
name: SaaS Refactor Etapa 25 — CSP enforcing
description: Cambio de Content-Security-Policy-Report-Only a Content-Security-Policy en index.html
type: feature
---

# Etapa 25

## Cambio
- `index.html`: header meta cambia de `Content-Security-Policy-Report-Only` a `Content-Security-Policy`.
- Allowlist sin cambios respecto a Etapa 18/21 (permisiva: `https:` global) para no romper integraciones de terceros (Cloudflare, GA, Tag Manager, etc.).

## Justificación
- Telemetría revisada en `csp_violations`: 0 registros tras 24-48h en producción → ningún recurso legítimo cae fuera del allowlist actual.
- Pasamos a enforcing ahora para que el browser bloquee inyecciones inline maliciosas.

## Próximo
- Etapa 26+: Endurecer allowlist a hosts específicos (sustituir `https:` por dominios concretos) cuando se inventaríe el catálogo de scripts third-party dinámicos (`custom_scripts`).
