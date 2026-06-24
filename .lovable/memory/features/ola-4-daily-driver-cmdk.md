---
name: Ola 4 Slice 4 — Cmd+K extendido
description: Búsqueda global de pedidos por número y facturas DIAN por full_number/cufe en GlobalCommandPalette
type: feature
---
# Ola 4 Slice 4 — Cmd+K (pedidos + facturas)

`GlobalCommandPalette` ya existía con productos + tabs + recientes. Slice 4 añade:

- **Pedidos por número**: si la query contiene dígitos, busca `orders` por `order_number` en rango `[n, n+999]` (org actual, top 6). Click navega a `/admin?tab=orders&edit=:id` (admin) o `/pedido/:order_number` (otros roles).
- **Facturas DIAN**: `electronic_invoices.full_number ilike` u `cufe ilike` (solo superadmin/admin, query ≥3 chars, top 6). Click navega a `/admin/innapsis`. Status coloreado (verde=accepted, rojo=error/rejected/dead_letter).
- Placeholder actualizado: "Buscar producto, pedido #, factura, tab o módulo…".

Orden de grupos en results: Recientes → Pedidos → Facturas → Productos → Acciones por grupo. Productos sigue siendo `ilike` por `name`/`sku`.

POS conserva su propia paleta (`POSCommandPalette`) — global no se monta dentro de `/pos*`.
