# Contrato de traslado — SistecPOS Core → Tienda Plus by SistecPOS

**Estado:** READY_TO_HAND_OFF
**Uso:** copiar el bloque "PROMPT" en el chat del proyecto Tienda Plus.
**Alcance:** gestión + vistas, backend completo, facturación electrónica Innapsis, POS rápido.
**Regla base:** todo se implementa como **extensión aditiva**; prohibido renombrar, mover o
romper tablas, rutas, componentes o endpoints existentes en Tienda Plus.

---

## PROMPT (copiar tal cual)

**Contexto:** vas a incorporar a este proyecto (Tienda Plus by SistecPOS) el contrato de
diseño y datos de **SistecPOS Core** para lograr paridad y doble vía total. Ya existen aquí
piezas similares (catálogo, pedidos, pagos, ping, sync). **No dupliques ni renombres nada.**
Antes de crear cualquier tabla, ruta, hook o componente, **audita lo existente** y decide:
`REUTILIZAR` / `EXTENDER` / `CREAR`. Entrega al final una tabla con esa decisión por ítem.

### 0. Reglas no negociables

1. Cambios **aditivos**: columnas nuevas siempre `NULL` o con `DEFAULT`; nada de `DROP` ni
   `RENAME`; nada de cambios de tipo en columnas en uso.
2. Arquitectura hexagonal estricta: `core/domain` → `core/use-cases` → `core/ports` →
   `infrastructure/*` → `presentation/*`. **Ningún componente React habla directo con la
   base de datos ni con APIs externas.** Primero el puerto, luego el caso de uso puro
   (TypeScript sin React), luego el adaptador, y al final la UI.
3. Multi-tenant real: toda tabla nueva lleva `organization_id uuid not null`, RLS activa y
   `GRANT` explícito en la misma migración (`authenticated` según política, `service_role`
   siempre). Sin `GRANT` la tabla es inalcanzable.
4. Roles en tabla aparte (`user_roles` + función `has_role` SECURITY DEFINER). Jamás roles
   en `profiles`. Prioridad: superadmin > admin > editor > user > cashier.
5. Secretos (llaves Innapsis, certificados, api keys) **solo** en el backend; al navegador
   baja únicamente el prefijo enmascarado (`tp_pos_xxxx…1234`).
6. Validación con Zod en todo borde de entrada (formularios, respuestas de terceros,
   payloads de webhooks). Respuestas de APIs externas son datos no confiables.
7. UI: React + TypeScript + Tailwind + shadcn/ui, mobile-first (390px), plano y denso,
   sin sombras pesadas ni gradientes. Skeletons obligatorios en toda carga asíncrona.
   Nada de tablas anchas en móvil: se convierten en tarjetas verticales.
8. Toda mutación crítica queda auditada (quién, cuándo, qué, desde dónde).

### 1. Modelo de datos (crear solo lo que falte)

**Organización y acceso**
- `organizations`: `id`, `slug` único, `name`, `business_type` (`detal|horeca|minimercado|distribuidor|casa|casa_cambio`), `city`, `nit`, `address`, `phone`, `email`, `logo_url`, `currency_code` default `COP`, `timezone` default `America/Bogota`, `lifecycle_state` (`pending|trial|active|past_due|suspended|archived`), `created_by`, `created_at`.
- `organization_members`: `organization_id`, `user_id`, `role`, `pin_hash`, `is_active`, `last_seen_at`. Único por (`organization_id`,`user_id`).
- `user_roles`: `user_id`, `role` (enum `app_role`). Único por par.
- `locations` (sedes) y `warehouses` (bodegas) con `organization_id`.
- Función `current_org_id()` y `can_write_org(org)` usadas por todas las políticas RLS.

**Catálogo**
- `categories`, `brands`: `organization_id`, `name`, `slug`, `is_active`, `sort_order`, `image_url`.
- `products`: `organization_id`, `name`, `slug`, `sku`, `gtin`, `price`, `cost_price`, `tax_rate`, `category_id`, `brand_id`, `is_active`, `track_stock`, `unit_measure`, `unit_quantity`, `net_weight_grams`, `image_url`, `updated_at`.
- `product_media` (`sort_order` arrastrable), `product_presentations` (unidad base + `factor_conversion`), `product_stock` (por `warehouse_id`), `stock_movements` (auditoría de cada movimiento), `product_lots` (`lot_code`, `expires_at`, `quantity`) con consumo FEFO.
- `price_lists` + `price_list_items` (detal / mayorista / distribuidor). Precio efectivo = lista del cliente → precio base como respaldo.
- `modifier_groups` + `modifier_options` (`min_select`, `max_select`, `pricing_mode` que soporta `sum` y `max_price` para pizzas).

**Ventas**
- `pos_orders`: `organization_id`, `location_id`, `order_number`, `channel` (`counter|delivery|platform|table|takeaway`), `customer_*`, `subtotal`, `discount_total`, `tax_total`, `total`, `status`, `cash_session_id`, `einvoice_doc_type`, `created_by`, `created_at`.
- `pos_order_items`: producto, nombre congelado, `quantity`, `unit_price`, `discount`, `tax_rate`, `total`, modificadores en JSON.
- `pos_payments`: `method` (efectivo, tarjeta, transferencia, mixto), `amount`, `received`, `change`, `reference`.
- `parked_tickets` (suspendidas) y `pos_quotes` (cotizaciones con `valid_until`).
- `cash_sessions` + `cash_movements` + `cash_session_counts` (arqueo por denominación) + `pos_void_log`.

**Facturación electrónica (Innapsis)**
- `einvoice_configs` (1 por organización): `provider` default `innapsis`, `environment` (`habilitacion|produccion`), `client_id`, `client_secret` (sin GRANT), `nit`, `razon_social`, `regimen`, `responsabilidades_fiscales`, `resolution_number`, `resolution_prefix`, `resolution_from`, `resolution_to`, `resolution_current`, `resolution_valid_until`, `test_set_id`, `pos_behavior` JSON (`default_doc_type`, `ask_on_each_sale`, `auto_send_email`, `auto_send_whatsapp`), `dian_health_status`, `is_active`.
- `document_types` (catálogo global) + `organization_document_types` (habilitados por tienda): factura electrónica de venta, documento equivalente POS electrónico, nota crédito, nota débito.
- `electronic_invoices`: `organization_id`, `pos_order_id`, `doc_type`, `prefix`, `number`, `cufe`, `track_id`, `qr_data`, `xml_url`, `pdf_url`, `status` (`queued|sending|accepted|rejected|contingency`), `is_contingency`, `contingency_emitted_at`, `error_message`, `retry_count`, `next_retry_at`, `emitted_at`.
- `einvoice_events`: bitácora inmutable de cada intento/respuesta.
- Índice parcial para pendientes de contingencia y para reintentos vencidos.

**Integración POS ↔ Tienda**
- `pos_connections` (equivalente a `tiendaplus_connections`): `organization_id` único, `base_url`, `api_key` (hash, **sin GRANT**), `api_key_prefix`, `scopes` (`catalog|sales|payments`), `enabled`, `exposed`, `allow_owner_manage`, `sync_catalog`, `sync_orders`, `sync_payments`, `catalog_cursor`, `orders_cursor`, `last_ping_at`, `last_sync_at`, `last_error`.
- `pos_sync_log`: `direction` (`push|pull|payment`), `entity`, `status` (`success|error|partial|unsupported`), `items`, `ok_count`, `failed_count`, `detail`, `created_at`.
- `webhook_endpoints` + `webhook_deliveries` con firma HMAC y reintentos con backoff.

### 2. API pública (doble vía) — completar lo que falte

Header `x-api-key` (prefijo `tp_pos_`, hasheada en DB). Rate limit por llave y por IP.
Error uniforme: `{ "error": { "code": "...", "message": "...", "details": {} } }`.
Todas las listas paginadas (`page`, `pageSize`, `totalItems`, `totalPages`) y ordenadas por
cursor de actualización. Toda escritura acepta `Idempotency-Key`.

| Acción | Endpoint | Scope |
|---|---|---|
| Ping / capacidades | `GET /api/public/pos/ping` | — |
| Subir catálogo (lotes ≤100) | `POST /api/public/pos/catalog` | catalog |
| Bajar precios/stock incrementales | `GET /api/public/pos/catalog?updatedSince=` | catalog |
| Bajar pedidos nuevos | `GET /api/public/pos/sales?since=&status=` | sales |
| Confirmar estado de pedido | `PATCH /api/public/pos/sales/{id}` | sales |
| Cobrar | `POST /api/public/pos/payments` | payments |
| Estado del cobro | `GET /api/public/pos/payments/{referencia}` | payments |
| Emitir documento electrónico | `POST /api/public/pos/einvoice` | einvoice |
| Estado del documento | `GET /api/public/pos/einvoice/{trackId}` | einvoice |

`ping` devuelve `companyName`, `currencyCode`, `scopes`, `gateway` y un arreglo
`capabilities` con los endpoints realmente publicados, para que el cliente degrade solo.
Todo endpoint no publicado responde `501` con `code: "unsupported"` — nunca 500.

### 3. Backend (edge functions)

- `pos-connector`: acciones `save_credentials` (valida contra ping antes de guardar), `ping`, `set_flags`, `set_exposure`, `push_catalog`, `pull_catalog`, `pull_orders`, `charge`, `charge_status`. Escribe siempre en la bitácora.
- `innapsis-emit`: OAuth con el proveedor, arma el XML/JSON del documento, maneja resolución y consecutivo con bloqueo transaccional, ramifica a **contingencia** cuando la DIAN no responde (`is_contingency=true`, `status='contingency'`).
- `einvoice-retry` (cron 5 min): backoff 1/5/30/120/720 min, `idempotency_key` de 24 h.
- `einvoice-contingency-flush` (cron 2 min): lotes de 25, throttle por organización.
- `dian-health-check` (cron 5 min): actualiza `dian_health_status`.
- `webhook-dispatch`: firma HMAC, reintentos, registro de entregas.
- Todas usan `auth.getUser` para el actor y `service_role` solo para escribir; nunca devuelven secretos.

### 4. Vistas y gestión (presentation)

**Admin de la tienda** (`/admin/...`)
- `productos`: tabla virtualizada, edición masiva en línea, selección múltiple, import/export CSV con reporte de errores por fila, arrastre de imágenes.
- `inventario`: existencias por bodega, movimientos, conversión de unidades (compra→venta) con recosteo promedio, lotes y alertas de caducidad.
- `precios`: listas por tipo de cliente y edición masiva por porcentaje.
- `pedidos`: bandeja por canal y estado, detalle con línea de tiempo, reimpresión.
- `caja`: apertura, movimientos, arqueo por denominación y cierre Z.
- `facturacion`: pestañas Configuración (Innapsis, resolución, tipos de documento), Comportamiento POS, Emitidas (con filtro por estado y reintento manual), Bitácora.
- `integraciones`: estado de conexión POS, ping, banderas de sincronización, bitácora.
- `usuarios`: crear miembro, asignar rol, PIN, definir contraseña, desactivar.

**Superadmin** (`/superadmin/...`)
- Listado de tiendas con estado de ciclo de vida y salud.
- Panel de integraciones por tienda: `exposed` y `allow_owner_manage`.
- Bitácora de auditoría y reseteo de contraseñas.

**POS rápido** (`/pos`)
- Ventana fija `h-[100dvh] overflow-hidden`; scroll solo interno.
- Tres zonas: catálogo virtualizado con búsqueda instantánea (mapa en memoria, O(1) por código de barras), ticket con totales, y barra de acciones.
- Objetivos táctiles de 44–56 px. Total en tipografía numérica grande.
- Teclado: `F2` buscar, `F3` cliente, `F4` suspender, `F5` cobrar, `F6` suspendidas, `F7` cotización, `Ctrl+P` reimprimir último, `+`/`-` cantidad, `Esc` cancelar. Lector de código de barras tratado como ráfaga de teclado.
- Diálogo de cobro compacto: efectivo/tarjeta/transferencia/mixto, cálculo de cambio en vivo, teclado numérico plegable, sin desbordar la pantalla.
- Selector de tipo de documento con autosugerencia (si el cliente tiene NIT → factura electrónica; si no → documento equivalente POS).
- Al finalizar: insignia de estado del documento electrónico en vivo, y acciones Imprimir / Ver PDF / Email / WhatsApp.
- Banderas de estado en la barra: salud DIAN, resolución por agotarse, contingencia activa, cola de emisión del turno.
- Bloqueo por PIN antes de cobrar y auto-lock configurable (3 min por defecto), con registro de bloqueo/desbloqueo.
- Offline-first: catálogo y tickets en IndexedDB, bandeja de salida con reintento y bitácora de conflictos; el POS vende sin internet y sincroniza al volver.
- Impresión térmica ESC/POS por bytes crudos (LAN/RAW o agente local), sin diálogo del navegador.

### 5. Entregables

1. Migraciones aditivas con RLS + GRANT por tabla nueva.
2. Puertos, casos de uso puros con pruebas, adaptadores y edge functions.
3. Vistas listadas arriba con skeletons y estados vacíos.
4. `docs/api/openapi.yaml` actualizado + colección de ejemplos.
5. Tabla final `REUTILIZAR / EXTENDER / CREAR` justificando cada decisión.

**Criterio de aceptación:** con una sola llave `tp_pos_` y `base_url`, un cliente externo
puede hacer ping, subir catálogo por lotes, bajar precios/stock incrementales, bajar y
confirmar pedidos, cobrar, consultar el cobro y emitir/consultar documentos electrónicos —
todo idempotente, paginado, con errores uniformes y bitácora — y la tienda opera su POS
rápido offline sin que nada de lo que ya existía deje de funcionar.
