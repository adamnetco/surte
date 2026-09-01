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
# 1) build web para escritorio (rutas relativas, obligatorio para file://)
bun run build:desktop

# 2) deps de escritorio (una vez)
cd electron
npm i -D electron
npm i usb @abandonware/noble        # opcional: USB nativo + Bluetooth LE

# 3) arrancar el cliente
npx electron ../electron/main.cjs
```

> **Importante:** el build de escritorio debe hacerse con `bun run build:desktop`
> (o `npm run build:desktop`), que aplica `base: './'`. Con el build web normal la
> ventana sale en negro.

Verificación rápida dentro de la app:
`Menú ⋮ → Estado del sistema` debe mostrar **Entorno: Electron**, el agente de
impresión en `127.0.0.1:9101` y la fila **Versión del cliente** (avisa si hay una
release más nueva publicada).

---

## 5. Empaquetar el instalador

```bash
bun run build:desktop
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
| Ventana en blanco | Build hecho con `bun run build`; usa `bun run build:desktop` |
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

---

## 10. Pantalla en negro / sin datos al abrir el .exe (causas y arreglo)

Cinco fallos concretos producen exactamente ese síntoma. Ya están corregidos en el
código; si vienes de un build anterior, **rehaz `npm run build`**.

| Causa | Síntoma | Arreglo |
| --- | --- | --- |
| Build hecho con `npm run build` en vez de `npm run build:desktop` | Ventana negra total, `dist/index.html` pide `/assets/...` que no existe bajo `file://` | Usa `npm run build:desktop` (aplica `base: './'`) |
| `BrowserRouter` bajo `file://` | Assets cargan pero ninguna vista se monta | Ya aplicado: la app usa `HashRouter` automáticamente cuando `location.protocol === 'file:'` |
| Build sin `.env.local` | No se conecta a la base de datos; pantalla vacía sin mensaje | Ya aplicado: ahora sale una pantalla “Configuración incompleta”. Crea `.env.local` y **rehaz `npm run build:desktop`** |
| Service worker bajo `file://` | Excepción en el arranque que aborta el render | Ya aplicado: registro de SW deshabilitado bajo `file://` |
| `HostGuard` sin hostname | Pantallas “Esta sección vive en…” en rutas del panel | Ya aplicado: `file://` se trata como entorno de desarrollo |

Además, el proceso principal ahora avisa con un cuadro de diálogo si falta
`dist/index.html` o si el renderer falla al cargar, en vez de quedarse en negro.

### Orden correcto de ejecución

```powershell
copy .env.local.example .env.local   # y revisa los valores
npm install
npm run build:desktop                # SIEMPRE después de tocar .env.local
cd electron
npm install
npx electron ../electron/main.cjs
```

### `EBUSY: resource busy or locked ... electron-release\...`

El empaquetador no puede borrar la carpeta porque la app anterior sigue abierta o
la tiene tomada el antivirus/explorador. Cierra `SistecPOSDesktop.exe`, cierra el
Explorador en esa ruta y borra la carpeta antes de reempaquetar:

```powershell
taskkill /IM SistecPOSDesktop.exe /F 2>$null
Remove-Item -Recurse -Force ..\electron-release
npx @electron/packager .. "SistecPOSDesktop" --platform=win32 --arch=x64 --electron-version=31.7.7 --out=../electron-release --overwrite --ignore="^/src" --ignore="^/public" --ignore="^/electron-release"
```

> **Versión de Electron fijada:** los scripts `package:linux|win|mac` de
> `electron/package.json` ya incluyen `--electron-version=31.7.7`, igual que la
> dependencia `electron` instalada, para que el binario empaquetado coincida
> exactamente con el entorno probado en desarrollo. Además, el `package.json`
> raíz declara `"main": "electron/main.cjs"` para que el empaquetador
> encuentre siempre el proceso principal correcto.

### `npm audit` avisa de 10 vulnerabilidades en `electron/` — ¿qué hago?

**Nada, y sobre todo NO ejecutes `npm audit fix --force`.**

- Esas dependencias (`electron`, `@electron/packager`, `usb`, `noble`) son de
  desarrollo/empaquetado: no se publican en el `.exe` ni las ejecuta el POS.
- `npm audit fix --force` sube Electron a la major 44 y `@electron/packager` a la
  20, que ya no coinciden con `--electron-version=31.7.7`; además intenta
  resolver `undefined@undefined` y aborta con `ETARGET`, dejando `node_modules`
  a medias.

Si ya lo ejecutaste, restaura así:

```powershell
cd electron
git checkout -- package.json          # descarta los cambios de audit fix
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
npm install usb @abandonware/noble    # opcional (USB nativo + BLE)
```

Las versiones de `electron/package.json` están **fijadas sin `^`** justamente
para que `npm install` reproduzca siempre el entorno probado (Electron 31.7.7).
Si algún día quieres actualizar Electron, hazlo a mano y sincroniza el flag
`--electron-version` de los scripts `package:*` en el mismo cambio.


### Licencia / heartbeat en local

`electron/main.cjs` usa `SURTEYA_SUPA_ANON` para llamar a las edge functions de
licencia. Si está vacío, la activación falla (la UI sigue funcionando). Para
probar el flujo completo, exporta la variable antes de arrancar:

```powershell
$env:SURTEYA_SUPA_ANON="<anon key>"
npx electron ../electron/main.cjs
```
