
# Sistema de Impresión Térmica SistecPOS

Solución completa en 4 capas: **DB → Ticket renderable → Driver WebUSB/Web Serial/Bluetooth → Agente de impresión de red**.

## 1. Base de datos (migración)

Nuevas tablas en `public`, con GRANTs + RLS por `organization_id` (políticas vía `is_member_of` y `can_write_org`):

- `printers` — `id, organization_id, name, model (58|80mm), connection (usb|lan|bluetooth|agent), ip_address, port (9100), vendor_id, product_id, paper_width_mm, characters_per_line, codepage, cuts_paper, opens_drawer, status, last_seen_at, is_default, location_id`
- `kitchen_stations` *(ya existe)* + nueva columna `printer_id uuid references printers`
- `printer_routing_rules` — `id, organization_id, category_id|product_id|modifier_group_id, printer_id, copies, prints_on (ticket|kitchen|both), priority` (override flexible)
- `print_jobs` — `id, organization_id, printer_id, pos_order_id, kind (receipt|kitchen|preorder|drawer|test), payload jsonb (ESC/POS commands + render data), status (queued|printing|done|failed|cancelled), attempts, last_error, terminal_id, created_at, processed_at`
- `printer_terminals` — `id, organization_id, fingerprint, name, last_seen_at, capabilities jsonb` (registra cajas/cocinas que actúan como servidor de impresión)

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs` para que el agente reciba trabajos al instante.

RPC: `enqueue_print_job(_order_id, _kind)` que lee `printer_routing_rules` + `kitchen_stations` y crea N filas en `print_jobs` (una por impresora destino) con el payload precalculado.

## 2. Renderizador de ticket (`src/modules/printing/`)

```
src/modules/printing/
├── lib/
│   ├── escpos.ts          # Builder ESC/POS (init, align, bold, size, qr, barcode, cut, drawer)
│   ├── ticketBuilder.ts   # Genera comandos ESC/POS desde pos_order
│   ├── ticketHtml.tsx     # Render HTML 58/80mm para vista previa + fallback window.print()
│   └── codepages.ts       # CP437/CP858/Latin1 helpers para tildes/ñ
├── drivers/
│   ├── webusb.ts          # navigator.usb (Epson/Star/Xprinter vendor IDs)
│   ├── webserial.ts       # navigator.serial (fallback)
│   ├── webbluetooth.ts    # navigator.bluetooth GATT
│   └── agent.ts           # POST a agente local http://127.0.0.1:9101/print
├── hooks/
│   ├── usePrinter.ts      # Selecciona impresora por defecto del terminal
│   └── usePrintQueue.ts   # Realtime → ejecuta jobs asignados a este terminal
└── components/
    ├── PrinterManager.tsx       # CRUD impresoras (admin)
    ├── PrinterRoutingTab.tsx    # Mapeo categoría → impresora
    ├── PrintPreviewDialog.tsx   # Vista previa + reimprimir
    └── TerminalRegistration.tsx # Registra este equipo como server de impresión
```

Ticket genera: encabezado (logo, razón social, NIT), datos cliente, líneas (qty × nombre — modificadores indentados — precio), totales, método de pago, código QR de verificación, pie de página, corte de papel.

## 3. Integración POS

- Al confirmar venta en `POSWorkspace.handlePaid`: tras `enqueue` exitoso del outbox, llamar `enqueue_print_job(order_id, 'receipt')` + `'kitchen'` si hay items con `kitchen_station_id`.
- Si el terminal tiene impresora local configurada, intentar imprimir inmediatamente desde el navegador (WebUSB/Serial) antes de delegar al agente.
- Botón "Reimprimir último" en POS Hub.

## 4. Agente de impresión (`electron/print-server/`)

Pequeño servicio Node embebido en la app Electron existente:
- Suscripción Realtime a `print_jobs WHERE status='queued' AND printer_id IN (impresoras de este host)`.
- Por cada job: envía bytes ESC/POS por TCP `printer.ip:9100` (LAN) o `node-usb`/`escpos-usb` (USB).
- Marca `status='done'` o `'failed'` con `last_error`.
- Heartbeat a `printer_terminals.last_seen_at` cada 30s.
- También expone `POST /print` local para que el navegador delegue cuando WebUSB no esté disponible (ej. Firefox).

## 5. UI Admin

Nuevo tab **Impresoras** en Admin CMS (`/admin`):
- Lista de impresoras con estado (online/offline) — badge superior, top-center toasts.
- Wizard "Detectar impresora" con WebUSB.
- Test de impresión + apertura de cajón.
- Mapeo visual: arrastrar categorías a impresoras.
- Vincular `kitchen_stations.printer_id`.

## 6. Detalles técnicos

- Codificación: CP858 (incluye €, ñ, tildes). Conversión UTF-8 → bytes en `escpos.ts`.
- Ancho: 58mm = 32 chars, 80mm = 48 chars (configurable).
- Vendor IDs comunes preconfigurados: Epson `0x04b8`, Star `0x0519`, Xprinter `0x0483`, Bixolon `0x1504`.
- HTTPS requerido para WebUSB/Serial/Bluetooth — ya cumplido en `*.lovable.app` y dominios custom.
- Fallback universal: si no hay driver disponible, abre `PrintPreviewDialog` con CSS `@media print { @page { size: 58mm auto; margin: 0 } }` y dispara `window.print()`.

## 7. Skill superpowers

Aplico el skill `using-superpowers` para:
1. **Brainstorm** primero (esta planificación).
2. **TDD** en `escpos.ts` y `ticketBuilder.ts` (tests vitest con snapshots de bytes).
3. **Debugging disciplinado** del flujo Realtime → agente.

## 8. Orden de entrega

Esta es solo la fase 1 (migración + renderer + driver WebUSB + UI básica). El agente Electron y Bluetooth quedan como fase 2 para no inflar un solo cambio. Te confirmo cada fase antes de pasar a la siguiente.

---

¿Apruebas el plan para arrancar con la **fase 1** (DB + render ESC/POS + WebUSB + tab Impresoras + integración en `handlePaid`)?
