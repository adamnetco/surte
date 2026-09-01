# Compilar SistecPOS Desktop en Windows (paso a paso)

Solo necesitas Visual Studio Build Tools + Python si vas a usar los módulos
**nativos opcionales**: `usb` (impresión USB sin diálogo) y `@abandonware/noble`
(Bluetooth LE). Sin ellos la app funciona con impresión LAN (TCP 9100) y con el
spooler RAW de Windows.

## 1. Requisitos base

1. **Node 20+** — https://nodejs.org (instalador LTS, marca "Add to PATH").
2. **Git** — https://git-scm.com/download/win
3. Abre **PowerShell** y verifica: `node -v` y `git --version`.

## 2. Toolchain nativa (solo si quieres USB/BLE nativos)

```powershell
# a) Compilador C++ (Visual Studio Build Tools 2022)
winget install --id Microsoft.VisualStudio.2022.BuildTools -e
# En el instalador marca: "Desarrollo para el escritorio con C++"
#   (incluye MSVC v143 + Windows 10/11 SDK)

# b) Python 3.x (node-gyp lo necesita)
winget install --id Python.Python.3.12 -e

# c) Verificar
python --version
```

Si `node-gyp` no encuentra Python, fíjalo explícitamente:

```powershell
npm config set python "C:\Users\<TU_USUARIO>\AppData\Local\Programs\Python\Python312\python.exe"
```

## 3. Proyecto

```powershell
git clone <url-de-tu-repo>.git sistecpos
cd sistecpos
npm install
```

Crea `.env.local` (ver [`run-local-desktop.md`](./run-local-desktop.md#2-variables-de-entorno)).

## 4. Build web + dependencias de Electron

```powershell
npm run build:desktop  # genera dist/ con rutas relativas (base './') para file://

cd electron
npm install            # instala electron + @electron/packager
npm install usb @abandonware/noble   # OPCIONAL: aquí se compila con MSVC+Python
```

Si esta última línea falla, no bloquea nada: bórrala y sigue. El print-agent
detecta la ausencia y expone solo `lan` + `usb_spooler`.

## 5. Ejecutar en modo desarrollo

```powershell
cd electron
npx electron ../electron/main.cjs
```

Comprueba en la app: **Menú ⋮ → Estado del sistema** debe decir
`Entorno: Electron` y mostrar el agente en `127.0.0.1:9101`.

## 6. Empaquetar el .exe portable

```powershell
cd ..
npm run build:desktop
cd electron
npx @electron/packager .. "SistecPOSDesktop" `
  --platform=win32 --arch=x64 `
  --out=../electron-release --overwrite `
  --ignore="^/src" --ignore="^/public" --ignore="^/electron-release"
```

Resultado: `electron-release\SistecPOSDesktop-win32-x64\SistecPOSDesktop.exe`.
Comprimir para distribuir:

```powershell
Compress-Archive -Path ..\electron-release\SistecPOSDesktop-win32-x64 -DestinationPath SistecPOS-win-x64.zip
```

Publicación de la release (bucket `desktop-releases` + tabla `desktop_releases`)
en [`run-local-desktop.md` §6](./run-local-desktop.md).

## 7. Impresora USB en Windows

WebUSB/libusb necesitan driver WinUSB. Instálalo con
[Zadig](https://zadig.akeo.ie/): *Options → List All Devices* → selecciona la
impresora → *WinUSB* → *Replace Driver*. Si prefieres no tocar drivers, usa la
ruta `usb_spooler` (driver del fabricante + `printer_name`).

## 8. Errores frecuentes

| Error | Causa / arreglo |
| --- | --- |
| `gyp ERR! find VS` | Falta la carga "Desarrollo para el escritorio con C++" |
| `gyp ERR! find Python` | `npm config set python <ruta python.exe>` |
| `MSB8020 / v143 not found` | Instala el Windows SDK dentro de Build Tools |
| Ventana en blanco | Usaste `npm run build` en vez de `npm run build:desktop` |
| `LIBUSB_ERROR_NOT_SUPPORTED` | Driver WinUSB no instalado (usa Zadig) |
| BLE no aparece | Requiere Windows 10 1709+ y Bluetooth activado |
