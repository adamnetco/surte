# POS — Emisión Innapsis desde el flujo POS (Wave 1)

**Estado:** IN_REVIEW — Todos los ACs (1-15) SHIPPED · listo para POS-review
**Módulo:** `pos` (consumidor) + `admin-cms` (config) + edge `innapsis-emit` (ya existe)
**Wave:** 1 — Innapsis Electronic Billing (NORTE/camino-a-produccion)
**Spec padre:** [POS-innapsis-integration.md](./POS-innapsis-integration.md) (Slices 1-4 SHIPPED)
**Tablas:** `electronic_invoices`, `einvoice_configs`, `einvoice_events`, `pos_orders`, `pos_payments`

## Problema

La integración Innapsis ya emite facturas correctamente vía outbox (`einvoice_emit` → `innapsis-emit`), pero el **flujo desde el POS al cajero** todavía no es production-ready:

1. **No hay feedback visible en pantalla** al cerrar la venta: el cajero no sabe si la factura DIAN se emitió, está en cola, falló o quedó en retry.
2. **No hay forma de re-imprimir/re-enviar** el documento desde el ticket recién cobrado sin salir a `/admin/facturacion`.
3. **Cobertura UX de errores cero:** si Innapsis devuelve `permanent` (4xx), el cajero solo ve un toast genérico — no entiende qué hacer.
4. **Modo contingencia DIAN no expuesto al cajero**: si DIAN/Innapsis está caído, no hay UX para emitir en modo offline-DIAN visible (referencia: Alegra POS muestra toggle dedicado).
5. **Selección de tipo de documento al cobrar es implícita**: el cajero no decide entre "Factura electrónica" / "POS electrónico" / "Documento Soporte" / "Nota crédito" desde el dialog de cobro — siempre se asume Factura.

Este spec cierra la última milla **POS → DIAN** para que un nuevo tenant pueda facturar electrónicamente desde día 1 sin intervención del soporte.

## Outcomes

### Selección de documento al cobrar
- [ ] **AC1:** El dialog de cobro (`SaleCompleteDialog` / `PaymentDialog`) muestra dropdown "Tipo de documento" con: `POS Electrónico` (default si plan ≥ Pro), `Factura Electrónica`, `Documento Soporte`, `Sin documento DIAN` (recibo interno).
- [ ] **AC2:** Si el cliente está identificado con NIT, se sugiere automáticamente `Factura Electrónica`. Consumidor final → `POS Electrónico`.
- [ ] **AC3:** El tipo elegido se persiste en `pos_orders.einvoice_doc_type`.

### Feedback en tiempo real post-cobro
- [ ] **AC4:** Tras presionar "Cobrar", el `SaleCompleteDialog` muestra estado en vivo de la factura DIAN: `Encolando…` → `Enviado a DIAN` → `Aceptado ✓ CUFE: XXXX` (badge verde) o `Reintentando (intento 2/5, próx. en 5m)` (badge ámbar) o `Error permanente: [motivo]` (badge rojo + botón "Ver detalles").
- [ ] **AC5:** Suscripción Realtime a `electronic_invoices` filtrada por `pos_order_id` → actualiza el badge sin recargar.
- [ ] **AC6:** Si en 3s no hay update (Innapsis lento), badge muestra `Procesando en segundo plano — puedes continuar`. El cajero no queda bloqueado.

### Acciones rápidas sobre el documento emitido
- [x] **AC7:** En `SaleCompleteDialog`, botones: `Imprimir POS` (siempre), `Ver factura` (drawer con PDF, si aceptada), `Email` (si aceptada + cliente con email), `WhatsApp` (si aceptada + cliente con teléfono). _Re-imprimir DIAN integrado en drawer (botones descargar PDF/XML)._
- [x] **AC8:** Botón "Ver factura" abre `InvoicePdfDrawer` lateral con PDF embebido + descarga XML/QR sin salir del POS.
- [x] **AC9:** Si el documento quedó en `retrying`/`rejected`/`dead_letter`, botón "Reintentar emisión ahora" fuerza nuevo intento (bypass backoff, requiere `isAdmin`).

### Modo contingencia DIAN
- [x] **AC10:** `DianHealthIndicator` montado en topbar POS leyendo `einvoice_configs.dian_health_status`. Cron `dian-health-check` cada 5 min recalcula estado por org desde `einvoice_events` recientes.
- [x] **AC11:** Ventas se emiten con `consecutivo_contingencia` (`einvoice_configs.contingency_range = {from,to,current,prefix}`). El XML lleva `Encabezado.Contingencia=true` (campo final a confirmar con Innapsis). `electronic_invoices.is_contingency=true`, `status='contingency'`, `contingency_emitted_at`. `ContingencyBanner` visible al cajero.
- [x] **AC12:** Cron `einvoice-contingency-flush` cada 2 min; cuando `dian_health_status != 'offline'`, retransmite las facturas pendientes (`is_contingency=true AND transmitted_at IS NULL`) en orden FIFO via `innapsis-emit` con `transmit_invoice_id` (service-role short-circuit, throttle 300ms/org, batch 25/run). Marca `transmitted_at` al recibir 2xx de DIAN.

### Configuración por organización
- [x] **AC13:** En `/admin/facturacion` tab "Comportamiento POS": (a) tipo documento default por organización, (b) toggle "Preguntar tipo en cada venta", (c) email/WhatsApp automático al cliente. Persistido en `einvoice_configs.pos_behavior` (JSONB).
- [x] **AC14:** `ResolutionStatusBanner` en `/pos/vender` lee `useEinvoiceResolutionStatus` (Realtime): muestra banner rojo si la resolución está agotada/ausente, ámbar si queda <=5%, gris si emisión inactiva. Apunta al cajero a *Facturación → Configuración*.

### Observabilidad cajero
- [x] **AC15:** `EinvoiceShiftWidget` en topbar POS: "Docs N · X ok · Y retry · Z err" con Realtime sobre `electronic_invoices`. Popover muestra últimos 10 docs del día + acción "Reintentar pendientes" (admin) que invoca `einvoice-resend` con `retry_all_today`.

## Schema DB (incremental)

```sql
ALTER TABLE pos_orders
  ADD COLUMN einvoice_doc_type TEXT
    CHECK (einvoice_doc_type IN ('factura_electronica','pos_electronico','doc_soporte','sin_dian'))
    DEFAULT 'pos_electronico';

ALTER TABLE einvoice_configs
  ADD COLUMN pos_behavior JSONB DEFAULT '{
    "default_doc_type":"pos_electronico",
    "ask_on_each_sale": false,
    "auto_send_email": true,
    "auto_send_whatsapp": false
  }'::jsonb,
  ADD COLUMN contingency_range JSONB,  -- {from: 1, to: 5000, prefix: "SETT"}
  ADD COLUMN dian_health_status TEXT DEFAULT 'online';
```

RLS hereda de tablas existentes.

## Componentes nuevos

- `src/modules/pos/components/EinvoiceStatusBadge.tsx` — badge en vivo (Realtime).
- `src/modules/pos/components/DocumentTypeSelector.tsx` — dropdown en `SaleCompleteDialog`.
- `src/modules/pos/components/DianHealthIndicator.tsx` — semáforo topbar.
- `src/modules/admin-cms/pages/EinvoicePOSBehavior.tsx` — config sección POS behavior.
- `src/modules/pos/hooks/useEinvoiceLiveStatus.ts` — Realtime subscription por `pos_order_id`.
- `src/modules/pos/hooks/useDianHealth.ts` — polling de health (5min cache).

## Edge functions

- **Modificar `innapsis-emit`**: aceptar parámetro `doc_type` y `contingency_mode`.
- **Nueva `einvoice-resend`**: re-envío email/WhatsApp on-demand (consume desde POS dialog).
- **Nueva `dian-health-check`**: cron 5min, recalcula `dian_health_status` agregando `einvoice_events` recientes.

## Métricas de éxito

- **Tiempo de feedback al cajero:** desde "Cobrar" hasta badge final < 5s en 90% de los casos.
- **Tasa de error visible:** 0 facturas en `dead_letter` sin que el cajero haya recibido alerta en pantalla.
- **Adopción modo contingencia:** durante caídas reales de DIAN, ≥95% de ventas se emiten con consecutivo de contingencia sin que el cajero tenga que hacer nada manual.
- **Reducción tickets soporte:** -70% en tickets categoría "no me llegó la factura DIAN" después de 30 días.

## Dependencias

- Slices 1-4 de [POS-innapsis-integration](./POS-innapsis-integration.md) SHIPPED ✅
- Resolución DIAN activa registrada en `einvoice_configs` por tenant
- (Opcional) WhatsApp Business API configurada para auto-envío vía WhatsApp

## Decisiones pendientes

1. ¿Bloquear cobro si DIAN está offline Y no hay rango de contingencia configurado? — Proponer: SÍ, con banner explicativo + opción de admin de "Cobrar sin DIAN" (queda como `sin_dian` en `pos_orders`).
2. ¿Default doc type por business_type? — Proponer: Minimercado/Retail → `pos_electronico`, HORECA → `pos_electronico`, B2B/Mayorista → `factura_electronica`, Casa de Cambio → `doc_soporte`.
3. ¿UX del PDF in-drawer o nueva pestaña? — Proponer: drawer (no saca al cajero del POS).

## Fuera de scope (v1.1+)

- Notas crédito / notas débito (Wave 1.5 separada).
- Anulación de documento DIAN desde POS (requiere flujo legal más estricto).
- Multi-resolución (varios rangos activos por punto de venta).
- Firma con certificado propio (hoy 100% delegado a Innapsis).

## Out-of-scope absoluto

- No reemplaza `/admin/facturacion` como panel maestro de gestión histórica. Este spec es UX cajero en vivo; el admin queda para auditoría/exportación/CSV.
