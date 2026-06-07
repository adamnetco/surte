# SURTÉ YA Desktop (Electron) + Print Agent

Cliente local reforzado con activación Ed25519, fingerprint de máquina, SQLite cifrado **y agente de impresión embebido** (USB nativo + LAN + Bluetooth).

## Modelo de licencia

- 1 `license_key` (UUID) por organización con `max_terminals` (cupo de equipos).
- Cada equipo genera un **fingerprint** (`sha256(MAC + CPU + hostname + arch)`).
- `register_activation` rechaza nuevos equipos si se excede el cupo.
- El token Ed25519 expira a los 7 días → el desktop hace **heartbeat** cada 30 min para renovarlo.
- Si la licencia se suspende o el seat se revoca, el siguiente heartbeat cierra la app.

## Print Agent (http://127.0.0.1:9101)

El agente arranca automáticamente con Electron y expone:

| Endpoint | Método | Descripción |
| --- | --- | --- |
| `/health` | GET | Devuelve `capabilities` (lan, usb_native, usb_spooler, bluetooth) |
| `/print` | POST | Imprime ESC/POS en base64. Campos: `connection`, `escpos_b64`, `ip_address`/`port` (LAN), `vendor_id`/`product_id`/`printer_name` (USB), `bluetooth_address` (BLE) |
| `/ble/pairings` | GET | Lista pairings BLE persistidos en `~/.surteya-print-agent/ble-pairings.json` |

### Capacidades por plataforma

| Capacidad | Dep nativa | Notas |
| --- | --- | --- |
| **LAN** TCP 9100 | ninguna | Siempre disponible. |
| **USB nativo** | `usb` (libusb) | Imprime sin gesto del usuario y sin foco del navegador. |
| **USB spooler RAW** | ninguna | Fallback automático si libusb falla. Requiere driver del SO + `printer_name`. |
| **Bluetooth LE** | `@abandonware/noble` | Pairing persistente. Imprime desde cola Realtime sin gesto. |

### Instalación de deps nativas (opcional pero recomendado)

```bash
# Linux / macOS
cd electron && npm i usb @abandonware/noble

# Windows (requiere build tools de Visual Studio + Python)
cd electron && npm i --global windows-build-tools && npm i usb @abandonware/noble
```

**Permisos por SO:**

- **Linux:** crear regla udev en `/etc/udev/rules.d/99-escpos.rules`:
  ```
  SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", MODE="0666"
  SUBSYSTEM=="usb", ATTR{idVendor}=="0519", MODE="0666"
  ```
  BLE necesita `setcap 'cap_net_raw,cap_net_admin+eip' $(which node)` o ejecutar con privilegios.
- **macOS:** dar permiso de Bluetooth a Electron en System Settings → Privacy. Firmar la app con entitlement `com.apple.security.device.bluetooth` para distribución.
- **Windows:** instalar driver WinUSB con [Zadig](https://zadig.akeo.ie/) para la impresora USB destino. BLE requiere Windows 10 1709+.

Si no se instalan las deps nativas, el agente sigue funcionando con LAN + spooler RAW, y el cliente cae automáticamente a WebUSB / WebBluetooth (que requieren gesto del usuario).

## Build local

```bash
export SURTEYA_SUPA_URL="https://dimyhjzcwlgfczimqhet.supabase.co"
export SURTEYA_SUPA_ANON="<anon-key>"

npm run build
cd electron && npm i -D electron @electron/packager && npm i usb @abandonware/noble
npx @electron/packager .. "SurteYaDesktop" \
  --platform=linux --arch=x64 --out=../electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'
```

Para macOS: `--platform=darwin`. Para Windows: `--platform=win32`.

Subir el binario empaquetado (`.tar.gz`/`.zip`/`.exe`) al bucket `desktop-releases`
y registrarlo en la tabla `desktop_releases` desde `/licencias` (tab "Instaladores").

## Refuerzo de protección (opcional)

1. `bytenode` para compilar `main.cjs` a V8 bytecode (`.jsc`).
2. `better-sqlite3` + SQLCipher para DB local cifrada con clave derivada del fingerprint.
3. `asar` activado por defecto en `@electron/packager`.
