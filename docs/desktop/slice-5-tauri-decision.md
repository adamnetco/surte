# Slice 5 — Informe de decisión: ¿Tauri + SQLite local?

**Fecha:** 2026-09-01 · **Autor:** arquitectura SistecPOS Core
**Regla de entrada del slice:** *“Tauri / SQLite local solo si los slices 1–4 no bastan.”*

## 1. Veredicto

> **NO migrar a Tauri ni a SQLite local por ahora.** Los slices 1–4 ya cubren los
> objetivos que motivaban ese cambio (ergonomía tipo escritorio, rendimiento con
> catálogos densos, hardware nativo y distribución/actualización). Se mantiene
> **Electron + Dexie (IndexedDB) + outbox** como runtime de escritorio oficial.

Revisar esta decisión solo si se cumple **alguno** de los disparadores del §4.

## 2. Qué exigía la propuesta original y dónde quedó cubierto

| Requisito de la propuesta “FoxPro/Tauri” | Estado actual | Dónde |
| --- | --- | --- |
| Flujo 100 % teclado (Enter avanza, F-keys, ESC) | ✅ Cubierto | `useEnterFlow`, `useGridKeyboardNav`, hotkeys F1–F12 + Ctrl+P/Ctrl+L en `POSWorkspace`, overlay F1 |
| Grids densos sin lag | ✅ Cubierto (ventana progresiva de 120 ítems, conserva DOM para navegación con flechas) | `useProgressiveList`, `POSCatalogBody` |
| Ventana sin scroll global, look de app instalada | ✅ Cubierto | `AppDesktopBar` (barra global 36 px, frameless, controles nativos), layout `h-dvh` sin scroll global |
| Base local + trabajo sin internet | ✅ Cubierto | Dexie (catálogo cacheado) + `sync_outbox` con reintentos y `flushOutbox` |
| Hardware: impresora ESC/POS, báscula, lector | ✅ Cubierto | `print-agent` local en `127.0.0.1:9101` (LAN, USB nativo/libusb, spooler RAW, BLE) |
| Aceleración GPU y arranque como binario | ✅ Cubierto | `electron/main.cjs` (hardware acceleration forzada, empaquetado con `@electron/packager`) |
| Actualización y licenciamiento | ✅ Cubierto | Puerto `IDesktopBridge`, `desktop_releases` + `IDesktopReleaseRepository`, aviso de nueva versión en “Estado del sistema”, licencias Ed25519 + fingerprint |

## 3. Por qué Tauri/SQLite **no** es la palanca correcta hoy

1. **El cuello de botella no es el runtime.** Los tiempos de respuesta del POS
   dependen de render de React y de red, no de Chromium vs WebView2. Cambiar de
   shell no mejora un componente que aún tiene ~2.2k líneas.
2. **Costo de reescritura del puente de hardware.** El `print-agent`
   (USB libusb + BLE + spooler RAW) es Node. En Tauri habría que reimplementarlo
   en Rust o seguir enviando un sidecar Node: el ahorro de peso desaparece.
3. **SQLite duplicaría la fuente de verdad.** Ya existe el par Dexie + outbox con
   idempotencia; añadir SQLite obliga a un tercer esquema y a migraciones
   locales versionadas, con riesgo de divergencia frente a Postgres.
4. **Riesgo regulatorio.** Facturación DIAN y sellos de arqueo dependen de
   funciones en Postgres. Mover cómputos fiscales a una DB local exigiría
   reauditar el encadenamiento de sellos.
5. **Impacto cero es prioridad.** Los slices 1–4 se entregaron sin romper la app
   publicada; una migración de shell es un cambio de plataforma, no un slice.

## 4. Disparadores que reabrirían la decisión

Reevaluar si se cumple **uno** de estos, medido y documentado:

- Arranque en frío del POS > 4 s en hardware objetivo (Celeron/4 GB) tras
  terminar el desacople de `POSWorkspace`.
- Interacción de teclado con retardo perceptible (> 100 ms) con > 20 000 SKU
  incluso con ventana progresiva.
- Requisito de operar > 8 h sin internet con historial de ventas consultable
  offline (hoy Dexie cachea catálogo, no histórico completo).
- Necesidad de distribuir binarios < 40 MB o firmar/notarizar con restricciones
  que Electron no cumpla.
- Consumo de RAM sostenido > 700 MB por terminal en producción.

## 5. Trabajo recomendado en lugar de migrar (orden de impacto)

Estado a 2026-09-01 (revisión del slice 5):

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| 1 | Desacoplar `POSWorkspace` | 🟡 en curso | 2.336 líneas (bajó desde 2.370). Ya se extrajo `POSCatalogBody`; faltan ticket, pagos y modo mesas. |
| 2 | Virtualización real (`@tanstack/react-virtual`) | 🟡 parcial | `VirtualRows` + `VirtualizedProductGrid` en admin/storefront. Faltan históricos de facturas y reportes densos. |
| 3 | Ampliar caché offline (últimos N tickets + clientes frecuentes) | ⛔ pendiente | Dexie solo cachea catálogo; sin TTL para tickets del turno. |
| 4 | Presupuesto de rendimiento en CI | ⛔ pendiente | No hay medición automática de LCP del POS ni de primer render de catálogo, así que los disparadores del §4 no se miden solos. |
| 5 | Pipeline de releases automatizado | 🟡 parcial | Existe `IDesktopReleaseRepository` + tabla `desktop_releases` y aviso de versión; el build → hash → bucket sigue siendo manual. |

Conclusión: el veredicto de no migrar sigue vigente, pero **falta cerrar 3 y 4**
para poder afirmar con datos que los disparadores del §4 no se cumplen.

## 6. Cómo ejecutarlo en local

Ver [`docs/desktop/run-local-desktop.md`](./run-local-desktop.md) (web + escritorio,
paso a paso) y [`docs/local-dev.md`](../local-dev.md) (entorno y variables).

## 6. Cómo ejecutarlo en local

Ver [`docs/desktop/run-local-desktop.md`](./run-local-desktop.md) (web + escritorio,
paso a paso) y [`docs/local-dev.md`](../local-dev.md) (entorno y variables).
