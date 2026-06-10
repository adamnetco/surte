---
name: Post-License Onboarding Flow
description: After superadmin issues a license in /licencias, success dialog + per-card "Configurar" button switch to that org and open the 5-step Onboarding wizard. Wizard flips onboarding_progress flags so /licencias shows real-time % progress per organization.
type: feature
---

# Flujo post-emisión de licencia

## Trigger
Superadmin emite licencia en `/licencias` → función edge `license-issue` devuelve `license_key` activa.

## Comportamiento
1. **Dialog de éxito** (`issuedInfo`) en `Licencias.tsx`:
   - Muestra la clave (copiada automáticamente al portapapeles).
   - CTA primario: **"Configurar tienda ahora"** → `switchOrg(orgId)` + `navigate('/onboarding?org=<id>')`.
   - CTA secundario: descarga del último `desktop_releases.is_current`.
2. **Auto-seed** de `onboarding_progress` (row vacío) al emitir, para que el badge arranque en 0%.
3. **Badge por tarjeta** de licencia en `/licencias`:
   - `Onboarding X%` (gris) o `Onboarding 100%` (verde) cuando `completed_at IS NOT NULL`.
   - Sublíneas con checks por paso: company, location, modules, einvoice, catalog.
4. **Botón "Configurar"/"Reconfigurar"** en cada tarjeta hace lo mismo que el CTA primario.

## Onboarding wizard (`/onboarding`)
- Acepta `?org=<id>`: si superadmin, hace `switchOrg` automático (siempre que la org esté en `orgs`).
- Cada paso (`next()`) hace `upsert` en `onboarding_progress` con la bandera correspondiente:
  - Paso 1 → `company_done`
  - Paso 2 → `location_done`
  - Paso 4 → `modules_done` (+ `einvoice_done` si activó facturación)
  - Paso 5 → `catalog_done` + `completed_at`

## Archivos
- `src/modules/superadmin/pages/Licencias.tsx` — dialog, progreso, CTA.
- `src/modules/clientes/pages/Onboarding.tsx` — `?org=` switch + upsert de progreso.

## Notas
- `OrganizationContext` ya carga TODAS las orgs cuando el rol es superadmin, por eso `switchOrg(orgId)` funciona sin ser miembro.
- Si se agrega un paso al wizard, actualizar `ONB_STEPS` en `Licencias.tsx` y la columna correspondiente en `onboarding_progress`.
