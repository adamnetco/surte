---
name: SaaS Refactor Etapa 28 — CSP allowlist por host
description: script-src, style-src, font-src y frame-src reducidos a dominios específicos
type: feature
---

# Etapa 28

## Cambio
`index.html` reemplaza el bare `https:` permisivo en directivas sensibles por allowlists explícitas:

- **script-src**: Supabase (`*.supabase.co`, `*.supabase.in`), Lovable (`*.lovable.app/dev/project.com`), Google Tag Manager / Analytics, Cloudflare Turnstile, Google Maps/reCAPTCHA. Mantiene `'unsafe-inline'` + `'unsafe-eval'` (Vite y libs internas).
- **style-src**: `'self'`, `'unsafe-inline'`, Google Fonts, Lovable.
- **font-src**: `'self'`, `data:`, Google Fonts CDN, Lovable.
- **frame-src**: Cloudflare Turnstile, Google (reCAPTCHA), Lovable preview.

## Mantenido permisivo
- **img-src** y **connect-src** siguen con `https:` por: storage signed URLs dinámicos, optimize-image edge, Supabase Realtime (`wss:`), integraciones third-party de tenants (Google Merchant feeds, Cloudflare APIs, etc.).
- **form-action** permite `https:` para WhatsApp wa.me y forms externos.

## Riesgos / Reversión
- Si un script third-party de `custom_scripts` apunta a un host no listado, será bloqueado. Endpoint `/csp-report` capturará la violación; ampliar allowlist según necesidad.
- Para revertir: restaurar `https:` en script-src (commit Etapa 25).

## Próximo
- Etapa 29 candidata: scriptear endurecimiento progresivo de `img-src` y `connect-src` tras 48h de telemetría limpia.
- Considerar `Content-Security-Policy-Report-Only` paralelo con `'strict-dynamic'` + nonces para eliminar `'unsafe-inline'`.
