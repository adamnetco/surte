---
name: SaaS Refactor Etapa 21
description: Página superadmin /seguridad/csp para visualizar violaciones recolectadas en etapa 20
type: feature
---

# Etapa 21 — Monitor de violaciones CSP

## Cambios
- Nueva página `src/modules/superadmin/pages/CspViolations.tsx`:
  - Lista las últimas 200 violaciones (`csp_violations`).
  - Tabla agregada por `(effective_directive, blocked_uri)` con contador y last_seen.
  - Botón recargar manual.
- Ruta `/superadmin/seguridad/csp` y entry en `SuperadminSidebar`.
- RLS de `csp_violations` (etapa 20) ya restringe SELECT a superadmin.

## Uso
1. Esperar 24-48h de tráfico real.
2. Revisar dominios `blocked_uri` recurrentes en script-src/connect-src/img-src.
3. Etapa 22: actualizar CSP en `index.html` con allowlist específica y cambiar `Content-Security-Policy-Report-Only` → `Content-Security-Policy` enforcing.
