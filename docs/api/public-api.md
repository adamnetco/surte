# SistecPOS Public REST API (v1)

API pública para consultar tus datos y registrar ventas/facturas desde sistemas externos (ERP, BI, e-commerce, integraciones).

**Base URL**
```
https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1/public-api/v1
```

## Autenticación

Crea una API key desde **Admin → API & Webhooks** (`/admin/api`). El secreto se muestra **una sola vez** y tiene el formato:

```
sk_<prefix>_<secret>
```

Envíalo en el header `Authorization`:

```
Authorization: Bearer sk_abcd1234_XYZ...
```

## Scopes

Selecciona los scopes al crear la key. Cada endpoint requiere un scope específico:

| Scope | Endpoints habilitados |
|---|---|
| `pos_orders:read` | `GET /v1/pos-orders` |
| `pos_orders:write` | `POST /v1/pos-orders` |
| `einvoices:read` | `GET /v1/electronic-invoices` |
| `einvoices:write` | `POST /v1/pos-orders/:id/emit-invoice` |
| `products:read` | `GET /v1/products` |
| `*` | todos los anteriores |


## Rate limit

- **120 req/min** por API key (ventana fija de 1 minuto).
- Todas las respuestas incluyen headers:
  - `X-RateLimit-Limit: 120`
  - `X-RateLimit-Remaining: 87`
  - `X-RateLimit-Reset: <unix-ts>`
- Al exceder: **`HTTP 429`** con `Retry-After: 60` y `{ "error": { "code": "RATE_LIMIT_EXCEEDED", ... } }`.

## Endpoints

### `GET /v1/me`
Información de la key y su organización.
```json
{
  "organization_id": "uuid",
  "scopes": ["pos_orders:read"],
  "limit": 120,
  "remaining": 119,
  "reset_at": "2026-06-28T23:59:00Z"
}
```

### `GET /v1/pos-orders?limit=50&since=2026-06-01T00:00:00Z`
Ventas POS más recientes (max `limit=200`).
```json
{ "data": [{ "id": "...", "ticket_number": 1234, "total": 89500, "status": "paid", "customer_name": "Juan", "paid_at": "..." }] }
```

### `GET /v1/electronic-invoices?limit=50&since=...`
Facturas electrónicas DIAN.
```json
{ "data": [{ "id":"...", "full_number":"FE001-1234", "cufe":"...", "total":89500, "status":"accepted", "qr_url":"...", "pdf_url":"...", "xml_url":"..." }] }
```

### `GET /v1/products?limit=100`
Catálogo activo.

### `POST /v1/pos-orders`
Crea una venta POS. Totales se recalculan en servidor a partir de `items[]`.

**Body**
```json
{
  "location_id": "uuid",
  "cash_session_id": "uuid",
  "customer_name": "Juan",
  "customer_document": "1098765432",
  "payment_method": "cash",
  "external_ref": "uuid-idempotency-key",
  "notes": "Pedido web #42",
  "items": [
    { "product_name": "Cerveza Club Colombia", "sku": "BEER-001", "quantity": 2, "unit_price": 5000, "tax_rate": 19, "discount": 0 }
  ]
}
```
**Idempotencia:** envía un UUID en `external_ref` para evitar duplicados (se mapea a `client_uuid`; si ya existe una venta con ese UUID en la org, se devuelve la existente con `"idempotent": true`).

**201 Created**
```json
{ "id": "uuid", "ticket_number": 1234, "total": 11900, "subtotal": 10000, "tax": 1900, "discount": 0 }
```

### `POST /v1/pos-orders/:id/emit-invoice`
Emite la factura electrónica DIAN (Innapsis) para una venta existente.

**Body (opcional)**
```json
{ "document_type": "invoice" }
```

**200 OK**
```json
{ "ok": true, "pos_order_id": "uuid", "result": { "cufe": "...", "full_number": "FE001-1234" } }
```

## Errores



| HTTP | code | Significado |
|---|---|---|
| 401 | `UNAUTHORIZED` | Token ausente, malformado, inválido, revocado o expirado |
| 403 | `FORBIDDEN` | La key no incluye el scope requerido |
| 404 | `NOT_FOUND` | Ruta desconocida |
| 429 | `RATE_LIMIT_EXCEEDED` | Más de 120 req/min |
| 500 | `INTERNAL` / `QUERY_ERROR` | Error del servidor |

## Ejemplo cURL

```bash
curl -H "Authorization: Bearer sk_abcd1234_XYZ..." \
  "https://dimyhjzcwlgfczimqhet.supabase.co/functions/v1/public-api/v1/pos-orders?limit=10"
```
