# Empaquetado Tauri + impresión ESC/POS

Runtime de escritorio alternativo a Electron. El binario es **genérico**: no
contiene identidad de tenant (ver `multitenant-runtime.md`). La organización se
resuelve por licencia en el primer arranque.

## Requisitos

| SO | Requisitos |
|---|---|
| Windows | Rust (rustup, toolchain `stable-msvc`), Visual Studio Build Tools (C++), WebView2 Runtime |
| macOS | Rust + Xcode Command Line Tools |
| Linux | Rust + `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` |

```bash
# 1) Rust
curl https://sh.rustup.rs -sSf | sh   # Windows: instalar rustup-init.exe
# 2) CLI de Tauri (no se agrega al bundle web)
cargo install tauri-cli --version "^2"
```

## Desarrollo

```bash
npm install
cargo tauri dev          # levanta Vite (:8080) y la ventana nativa
```

## Compilar instalador

```bash
cargo tauri build        # usa npm run build:desktop → dist/
```

Salidas en `src-tauri/target/release/bundle/`:
`nsis/*.exe`, `msi/*.msi` (Windows), `dmg/*.dmg` (macOS), `appimage`, `deb` (Linux).

> Falta agregar los iconos en `src-tauri/icons/` (`icon.png`, `icon.ico`,
> `icon.icns`). Generarlos con `cargo tauri icon ruta/al/logo.png`.

## Impresión térmica ESC/POS

Tauri **no** expone WebUSB, así que los bytes crudos se envían por comandos Rust
(`src-tauri/src/main.rs`) y el sistema operativo nunca abre un diálogo de impresión.

| Comando Rust | Uso |
|---|---|
| `escpos_print_tcp(host, port, bytes)` | Térmica de red, puerto RAW 9100 |
| `escpos_print_device(path, bytes)` | `\\SERVIDOR\TICKETERA` (Windows) o `/dev/usb/lp0` (Linux) |
| `desktop_runtime_info()` | Detección de runtime/plataforma |

Del lado web se usa el driver `src/modules/printing/drivers/tauri.ts`:

```ts
import { EscPosBuilder, buildReceipt } from "@/modules/printing";
import { isTauriRuntime, printOnceTauriTcp } from "@/modules/printing/drivers/tauri";

const bytes = buildReceipt(ticketData);      // mismo builder que Electron/Web
if (isTauriRuntime()) await printOnceTauriTcp("192.168.1.50", bytes);
```

Orden de resolución de driver (sin cambios para navegador/Electron):

1. `isTauriRuntime()` → comandos Rust.
2. Electron → agente local `print-agent.cjs`.
3. Navegador → WebUSB / WebBluetooth.

## Diferencias frente a Electron

| | Electron | Tauri |
|---|---|---|
| Tamaño instalador | ~85 MB | ~6 MB |
| RAM en reposo | ~180 MB | ~60 MB |
| WebUSB | Sí | No (se usa RAW TCP / device path) |
| Módulos nativos (`usb`, `noble`) | Requieren Build Tools | No aplican |

Electron sigue siendo el runtime soportado hoy; Tauri queda listo para
migración progresiva (ver `slice-5-tauri-decision.md`).
