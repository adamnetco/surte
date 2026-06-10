---
name: Desktop Release Publishing (DEFERRED)
description: Pending task — generate code/CI to build and publish SURTÉ YA Desktop (Electron) releases to desktop_releases table
type: feature
---

# Publicación de releases Desktop (POSPUESTA)

**Estado:** pospuesta a petición del usuario (2026-06-10). NO implementar hasta que el usuario lo solicite explícitamente.

## Alcance

Generar el flujo completo para publicar nuevas versiones del cliente Desktop (`electron/main.cjs`, `APP_VERSION` en `src/lib/version.ts`):

1. **Script de build local/CI** que:
   - Bumpee `package.json` + `src/lib/version.ts`.
   - Corra `vite build` + `@electron/packager` para `win32`, `darwin`, `linux` (ver skill `electron-desktop-app`).
   - Empaquete artefactos (`.zip` / `.tar.gz`).
   - Suba binarios a un bucket público (Supabase Storage `desktop-releases`) y devuelva URLs firmadas/públicas.

2. **Edge function `desktop-release-publish`** (superadmin-only) que:
   - Reciba `version`, `platform`, `channel`, `download_url`, `release_notes`, `size_bytes`, `sha256`.
   - Inserte en `desktop_releases` y opcionalmente marque `is_current = true` (desmarcando previas misma plataforma).
   - Dispare notificación (push/email) a terminales activos para auto-update.

3. **UI superadmin** en `src/modules/superadmin/pages/Licencias.tsx` (tab Releases):
   - Botón "Subir binario" con drag-drop → Storage → autollenado del form.
   - Verificación de checksum + tamaño.

4. **Auto-update en Electron** (`electron/main.cjs`):
   - Polling `desktop-releases` por plataforma cada heartbeat.
   - Descarga + verificación SHA256 + relaunch.

## Plan referenciado

Ver `.lovable/plan-desktop-release.md` para fases y tareas.

## Cuando se retome

Iniciar con: "ejecuta el plan de desktop release publishing".
