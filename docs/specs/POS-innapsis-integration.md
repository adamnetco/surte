# POS — Integración Innapsis (Facturación Electrónica DIAN)

**Estado:** IN_BUILD (Slices 1 y 2 SHIPPED)
**Módulo:** `admin-cms` + `pos` + `storefront`
**Tablas:** `einvoice_configs`, `electronic_invoices`, `einvoice_events`
**Edge functions:** `innapsis-emit`, `innapsis-status`
**Referencia XML:** `docs/specs/innapsis/xml-emision-v1.9-fields.csv` (especificación oficial Innapsis v1.9 — campos UBL para Factura Electrónica y Documento Soporte)

## Avance auditado

- ✅ **Slice 1 — UI de configuración**: SHIPPED. `Facturacion.tsx` con DEV/PROD toggle, validación NIT/DV (algoritmo DIAN), validación rango resolución, botón Probar conexión (`innapsis-status` modo ping).
- ✅ **Slice 2 — Emisión automática desde POS**: SHIPPED.
  - `useEinvoiceAutoEmit` lee `einvoice_configs.is_active` + `extra.auto_emit_threshold` + `extra.auto_emit_enabled`.
  - `POSWorkspace.handlePaid` encola `einvoice_emit` en `sync_outbox` (Dexie) inmediatamente después de `pos_order_create`, solo si el cliente tiene `docNumber` y `total ≥ threshold`.
  - Dispatcher `executeOp('einvoice_emit')` resuelve `client_uuid → pos_orders.id` antes de invocar `innapsis-emit` (evita race con la materialización de la orden).
  - El recibo POS se imprime SIEMPRE; la factura electrónica DIAN es opcional según umbral (acordado con el negocio).
- 🚧 Slice 3 — Mapping completo XML v1.9 (Encabezado, Emisor, Receptor, Totales, TaxTotal, Items) en `innapsis-emit`. Pendiente revisar payload actual contra `xml-emision-v1.9-fields.csv`.
- 🚧 Slice 4 — Worker robusto con reintentos exponenciales (1m, 5m, 30m, 2h, max 5) y dead-letter visible en `DeadLetterQueue.tsx`.
- 🚧 Slice 5 — UI de gestión avanzada (filtros, exportación CSV, modal detalle con timeline `einvoice_events`).
- 🚧 Slice 6 — Email automático con PDF+XML adjuntos.
- 🚧 Slice 7 — Modo contingencia DIAN.



## Problema

Hoy SistecPOS tiene la infraestructura (DB + edge functions esqueleto) pero **no hay UI de configuración ni flujo cerrado de emisión**. Un admin no puede:
1. Configurar su NIT, resolución DIAN y API key de Innapsis desde el panel
2. Habilitar emisión automática en POS o ecommerce
3. Ver estado de facturas emitidas, descargar PDF/XML
4. Reaccionar a fallos de Innapsis (reintentos, contingencia)

## Outcomes (Criterios de aceptación)

- [ ] **AC1:** Admin puede crear/editar `einvoice_config` desde `/admin/facturacion-electronica` con validación Zod
- [ ] **AC2:** Form valida NIT colombiano (DV calculado) y vigencia de resolución
- [ ] **AC3:** Test de conexión: botón "Probar Innapsis" que verifica API key contra `innapsis-status`
- [ ] **AC4:** Toggle por sucursal: "Emitir factura electrónica en esta ubicación"
- [ ] **AC5:** Al cerrar venta POS con cliente identificado (NIT/CC), si toggle activo → encolar emisión vía `sync_outbox`
- [ ] **AC6:** Edge function `innapsis-emit` lee de outbox, hace POST a Innapsis, guarda `cufe`, `qr_url`, `pdf_url`, `xml_url` en `electronic_invoices`
- [ ] **AC7:** Reintento exponencial (1m, 5m, 30m, 2h) si Innapsis responde 5xx; max 5 intentos
- [ ] **AC8:** Listado `/admin/facturacion-electronica/emitidas` con filtros (estado, rango fecha, cliente)
- [ ] **AC9:** Descarga PDF + XML desde el listado
- [ ] **AC10:** Email automático al cliente con PDF + XML adjunto (vía `email-queue`)
- [ ] **AC11:** Vista de eventos por factura (`einvoice_events`): timeline de cada cambio de estado
- [ ] **AC12:** Modo contingencia: si Innapsis lleva > 1h caído → marcar facturas como "contingencia DIAN" y generar consecutivo manual

## Arquitectura

```text
POS/Storefront → orders/pos_orders (cliente identificado)
        ↓
   sync_outbox (event_type=emit_invoice, payload={order_id})
        ↓
  edge fn innapsis-emit (cron cada 30s)
        ↓
  POST Innapsis API → cufe + qr + pdf_url
        ↓
  UPDATE electronic_invoices + INSERT einvoice_events
        ↓
  edge fn email-invoice (envía PDF+XML al cliente)
```

## Tareas (vertical slices)

### Slice 1 — UI de configuración
- `src/modules/admin-cms/pages/EInvoiceConfigPage.tsx`
- Hook `useEInvoiceConfig()`
- Validador Zod con cálculo de DV (algoritmo DIAN)
- Botón "Probar conexión" → invoca `innapsis-status`

### Slice 2 — Emisión desde POS
- Modificar `closeSale()` en POS para encolar emisión
- Cliente debe estar identificado (NIT o CC)
- Toggle por ubicación en `locations.extra.einvoice_enabled`

### Slice 3 — Worker robusto
- Reescribir `innapsis-emit` para procesar de `sync_outbox` (no llamada directa)
- Implementar reintentos con `next_retry_at`
- Logging en `einvoice_events`

### Slice 4 — UI de gestión
- Página de listado con tabs (emitidas / rechazadas / pendientes / contingencia)
- Modal de detalle con timeline + descargas
- Filtros y exportación CSV

### Slice 5 — Email automático
- Edge function `email-invoice` (adjunta PDF + XML desde URL de Innapsis)
- Template HTML branded
- Reintento si Resend falla

### Slice 6 — Modo contingencia
- Detector de caída de Innapsis (> 1h sin respuesta exitosa)
- Banner global "DIAN en contingencia"
- Consecutivo manual con prefijo `CONT-`
- Reemisión automática cuando Innapsis vuelva

## No-objetivos

- ❌ No soportar otros proveedores (Carvajal, Facture) en esta fase
- ❌ No notas crédito/débito todavía (siguiente iteración)
- ❌ No nómina electrónica
- ❌ No documento soporte
