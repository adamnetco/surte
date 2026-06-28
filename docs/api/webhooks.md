# SistecPOS Webhooks

Recibe eventos en tiempo real cuando algo cambia en tu cuenta (órdenes, facturas DIAN, stock bajo, etc.).

Configura endpoints desde **Admin → API & Webhooks** (`/admin/api`).

## Eventos disponibles

| Evento | Cuándo se dispara |
|---|---|
| `pos_order.created` | Se crea una venta POS |
| `pos_order.paid` | Una venta cambia a estado `paid` |
| `pos_order.voided` | Una venta es anulada |
| `einvoice.accepted` | DIAN acepta una factura electrónica |
| `einvoice.rejected` | DIAN rechaza una factura electrónica |
| `stock.low` | Un producto baja al/por debajo del `reorder_point` |

## Formato de la entrega (POST)

```
POST https://tu-endpoint
Content-Type: application/json
User-Agent: SistecPOS-Webhooks/1.0
x-sistecpos-event: pos_order.paid
x-sistecpos-delivery: 7f9c…-uuid
x-sistecpos-signature: sha256=<hex>

{
  "event": "pos_order.paid",
  "delivery_id": "7f9c…-uuid",
  "occurred_at": "2026-06-28T23:45:12.000Z",
  "data": { /* payload del evento */ }
}
```

## Verificación de la firma HMAC

Cada entrega va firmada con `HMAC-SHA256` usando el **secret** generado al crear el endpoint (visible una sola vez).

### Node.js
```ts
import crypto from "node:crypto";

export function verify(body: string, header: string, secret: string) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}
```

### Python
```python
import hmac, hashlib
def verify(body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
```

> Firma el **cuerpo crudo (raw body)** tal cual se recibe, antes de cualquier parseo JSON.

## Reintentos

- Timeout por intento: **15 s**.
- Reintentos con backoff exponencial: **1, 5, 15, 60, 240, 720, 1440, 2880 min** (8 intentos máximo).
- Tras 8 fallos se marca como `dead` (visible en la pestaña *Envíos recientes*).
- Tu endpoint debe responder `2xx` para considerar la entrega exitosa.

## Buenas prácticas

- Responde rápido (`200 OK`) y procesa en background.
- Implementa **idempotencia** usando `x-sistecpos-delivery` o `data.id`.
- Verifica **siempre** la firma antes de actuar sobre el payload.
- Guarda el secret en variable de entorno; nunca en el repositorio.
