---
name: Seguimiento de Pedido con WhatsApp
description: Vista pública /pedido/:orderNumber que consulta estados de WhatsApp y muestra historial cronológico por orden
type: feature
---

Vista de tracking público (sin auth) en `/pedido/:orderNumber`:

- Consulta `orders` por `order_number` (único por org).
- Lee `broadcast_logs` filtrados por `order_id` para mostrar el historial de mensajes/estados WhatsApp (sent, delivered, read, failed) en línea de tiempo.
- Realtime: suscripción a `orders` (status) y `broadcast_logs` (insert) para refrescar sin recargar.
- Estados clave del pedido: `pendiente → confirmado → preparando → en_camino → entregado | cancelado`.
- Cada item del timeline incluye: timestamp relativo, canal (WhatsApp), tipo (template/sesión), payload abreviado, link a reintentar si `failed`.
- Si el pedido no existe o el `order_number` no coincide, mostrar 404 amigable con CTA al WhatsApp de soporte.
- Mobile-first estricto (h-[100dvh]); usa `OrderTrackingPage` existente extendida con el bloque `WhatsAppHistory`.
