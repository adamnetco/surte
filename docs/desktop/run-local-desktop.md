# Ejecutar SistecPOS Core en local (web + escritorio)

Guía única y ordenada: clonar → correr en el navegador → correr como aplicación de
escritorio (Electron) → empaquetar el instalador → publicar la actualización.

Requisitos: **Node 20+**, `git`, y opcionalmente `bun`. En Windows, para USB/BLE
nativos, Visual Studio Build Tools + Python.

---

## 1. Clonar y dependencias

```bash
git clone <url-de-tu-repo-github>.git sistecpos
cd sistecpos
bun install          # o: npm install
```

## 2. Variables de entorno

Crea `.env.local` en la raíz (no edites `.env`, es gestionado por Lovable):

```env
VITE_SUPABASE_URL=https://dimyhjzcwlgfczimqhet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key del proyecto>
VITE_SUPABASE_PROJECT_ID=dimyhjzcwlgfczimqhet
```

Detalle completo en [`docs/local-dev.md`](../local-dev.md).

## 3. Correr en el navegador

```bash
bun dev              # http://localhost:8080
bunx vitest run      # tests unitarios
bun run build        # build de producción a dist/
```

El POS vive en `/pos/vender`. La barra superior global (`AppDesktopBar`) ya se
comporta como app instalada; los controles de ventana solo aparecen bajo Electron.

---

## 4. Correr como aplicación de escritorio (modo desarrollo)

El proceso principal está en `electron/main.cjs` y el bridge en
`electron/preload.cjs`. El agente de impresión (`electron/print-agent.cjs`)
arranca junto con la app y expone `http://127.0.0.1:9101`.

```bash
# 1) build web (Electron carga dist/ vía file://)
bun run build

# 2) deps de escritorio (una vez)
cd electron
npm i -D electron
npm i usb @abandonware/noble        # opcional: USB nativo + Bluetooth LE

# 3) arrancar el cliente
npx electron ../electron/main.cjs
```

> **Importante:** `vite.config.ts` debe tener `base: './'` para que `dist/`
> funcione bajo `file://`. Si la ventana sale en blanco, ese es el motivo.

Verificación rápida dentro de la app:
`Menú ⋮ → Estado del sistema` debe mostrar **Entorno: Electron**, el agente de
impresión en `127.0.0.1:9101` y la fila **Versión del cliente** (avisa si hay una
release más nueva publicada).

---

## 5. Empaquetar el instalador

```bash
bun run build
cd electron && npm i -D @electron/packager

npx @electron/packager .. "SistecPOSDesktop" \
  --platform=linux --arch=x64 \
  --out=../electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'
```

- Windows: `--platform=win32` · macOS: `--platform=darwin`
- Comprimir: `tar czf SistecPOS-linux-x64.tar.gz -C electron-release SistecPOSDesktop-linux-x64/`
  (o `zip -r` para win/mac).

## 6. Publicar la actualización

1. Sube el binario al bucket `desktop-releases`.
2. Registra la versión en la tabla `desktop_releases`
   (`version`, `platform`, `channel`, `download_url`, `sha256`, `size_bytes`,
   `is_current = true`) desde `/licencias` → pestaña *Instaladores*.
3. Sube `APP_VERSION` en `src/lib/version.ts` en el mismo release.

El cliente compara versiones con `compareVersions` (semver laxa) mediante el
puerto `IDesktopReleaseRepository` y muestra el botón **Descargar** en
*Estado del sistema* cuando hay una versión superior a la instalada.

---

## 7. Hardware (impresoras, básculas, lector)

| Elemento | Cómo funciona en local |
| --- | --- |
| Impresora ESC/POS LAN | Directo por TCP 9100, sin dependencias nativas |
| Impresora USB | `usb` (libusb); si falla, cae a spooler RAW del SO |
| Impresora Bluetooth | `@abandonware/noble`, pairings en `~/.surteya-print-agent/` |
| Lector de código de barras | Emulación de teclado, capturado por el POS |

Permisos por SO (udev en Linux, Zadig en Windows, privacidad Bluetooth en macOS):
ver [`electron/README.md`](../../electron/README.md).

---

## 8. Solución de problemas

| Síntoma | Causa / arreglo |
| --- | --- |
| Ventana en blanco | Falta `base: './'` en `vite.config.ts`; rehacer `bun run build` |
| `__dirname is not defined` | El proceso principal debe ser `.cjs`, no `.js` |
| “Agente de impresión no responde” | El agente no arrancó o el puerto 9101 está ocupado |
| No aparece aviso de versión | No hay fila `is_current = true` para esa `platform` en `desktop_releases` |
| Sesión no persiste | Revisa `.env.local`; no edites `src/integrations/supabase/client.ts` |
| Ventas sin salir de la cola | `Estado del sistema → Reintentar` (fuerza `flushOutbox`) |

---

## 9. ¿Y Tauri / SQLite local?

Decisión vigente: **no migrar**. Justificación, cobertura por slice y
disparadores para reevaluar en
[`docs/desktop/slice-5-tauri-decision.md`](./slice-5-tauri-decision.md).
