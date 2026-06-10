# Plan diferido: Publicación de releases Desktop (SURTÉ YA / SistecPOS Core)

> **Estado:** POSPUESTO. No ejecutar hasta orden explícita del usuario.
> **Memoria asociada:** `mem://features/desktop-release-publishing`

## Objetivo

Cerrar el ciclo de distribución del cliente Electron: build → empaquetado → upload → registro en `desktop_releases` → auto-update en terminales activas.

## Estado actual

- ✅ `electron/main.cjs` con fingerprint + activación + heartbeat.
- ✅ Tabla `desktop_releases` + UI en `Licencias.tsx` (alta manual de URL).
- ❌ Sin pipeline de build/publish.
- ❌ Sin bucket de Storage dedicado.
- ❌ Sin verificación de integridad (sha256).
- ❌ Sin auto-update en el cliente.

## Fases

### Fase 1 — Infraestructura de Storage (S)
- Crear bucket público `desktop-releases` con políticas: lectura anónima, escritura solo `service_role`.
- Estructura: `desktop-releases/{platform}/{version}/{filename}`.

### Fase 2 — Script de build (M)
- `scripts/build-desktop.mjs`:
  - Lee `--version`, `--platforms=win32,darwin,linux`.
  - Bumpea `package.json` + `src/lib/version.ts` + `APP_BUILD_DATE`.
  - Ejecuta `vite build` (asegurar `base: './'`).
  - Por plataforma: `@electron/packager` + zip/tar.
  - Calcula sha256 + size.
  - Sube a Storage vía `service_role`.
  - Imprime JSON con URLs y hashes.

### Fase 3 — Edge function `desktop-release-publish` (M)
- Verify JWT + check superadmin.
- Body: `{ version, platform, channel, download_url, release_notes, size_bytes, sha256, make_current }`.
- Inserta en `desktop_releases`, si `make_current` desmarca previas mismo `platform`.
- Audit log.

### Fase 4 — UI superadmin (S)
- En `Licencias.tsx` tab Releases:
  - Drag-drop file → upload directo a Storage (anon firma via edge function `desktop-release-sign-upload`).
  - Autollenar `version`, `platform`, `size`, `sha256`.
  - Botón "Publicar" → invoca `desktop-release-publish`.

### Fase 5 — Auto-update Electron (M)
- En `electron/main.cjs`, en heartbeat:
  - GET `desktop_releases` filtrado `platform=process.platform AND is_current=true`.
  - Si `version > APP_VERSION`: descargar, verificar sha256, mostrar diálogo, `app.relaunch()`.
- Persistir versión descargada en `userData/update.pending`.

### Fase 6 — CI/CD opcional (L)
- GitHub Action `release-desktop.yml`:
  - Trigger: tag `vX.Y.Z`.
  - Matrix: ubuntu-latest (linux+win32 cross), macos-latest (darwin).
  - Corre `scripts/build-desktop.mjs` + publica.
  - Notifica vía Discord/email.

## Checkpoint global

- [ ] Subir un binario de prueba a Storage.
- [ ] Publicar release v1.4.1 vía función.
- [ ] Una terminal con v1.4.0 detecta y auto-actualiza.
- [ ] Rollback: revocar marcando `is_current = false`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Cross-compile a macOS desde Linux falla por code signing | Documentar que `.app` sin firma genera warning de Gatekeeper; usar runner macOS para firma oficial |
| Binarios grandes (>100MB) en Storage | Bucket con tier público, considerar CDN externo (R2/B2) en Fase 6 |
| Auto-update corrompe instalación | Verificación sha256 obligatoria + backup de versión previa |
