---
name: SaaS Refactor Etapa 29 — CSP img-src/connect-src endurecidos
description: img-src y connect-src acotados a hosts conocidos tras telemetría limpia (7d sin violaciones)
type: feature
---

# Etapa 29

## Telemetría previa
`SELECT effective_directive, count(*) FROM csp_violations WHERE created_at > now() - interval '7 days'` → 0 filas. Etapa 25 (enforcing) + Etapa 28 (script/style/font/frame) no han generado violaciones.

## Cambio
`index.html`:
- **img-src**: `'self' data: blob:` + Supabase storage, Lovable, Google (userscontent/gstatic/analytics/tagmanager/maps), Unsplash, Cloudinary, CloudFront, S3, `storage.googleapis.com`.
- **connect-src**: `'self'` + Supabase (https + wss), Lovable, Google Analytics/Tag Manager/DoubleClick stats, Cloudflare Turnstile + API, Google Maps/Places.
- Resto (script/style/font/frame) sin cambios desde Etapa 28.
- `form-action` permanece `https:` (WhatsApp wa.me y forms externos del tenant).

## Riesgos
- Si un tenant carga imágenes desde un CDN no listado (p.ej. `shopify.com`), serán bloqueadas. `/csp-report` registrará la violación y `/superadmin/seguridad/csp` la mostrará → ampliar allowlist.
- `connect-src` no incluye dominios arbitrarios de integraciones tenant. Si alguna integración nueva (p.ej. webhooks salientes desde el navegador) requiere otro host, agregar explícito.

## Reversión rápida
Restaurar la línea de Etapa 28 (commit anterior) para volver a `img-src 'self' data: blob: https:` y `connect-src 'self' https: wss:`.

## Próximo
- Etapa 30 candidata: eliminar `'unsafe-inline'` / `'unsafe-eval'` del script-src usando nonces + `'strict-dynamic'` (requiere mover CSP a header HTTP server-side; meta no soporta nonces inyectados en runtime).
