

## Plan: Checkout Avanzado para Comerciales y Clientes

### Contexto
Transformar el checkout actual en una herramienta dual: catálogo digital para comerciales en campo + sistema de pedidos programados para clientes. Agregar campos de logística avanzada al flujo de compra.

### Cambios

#### 1. Migración de Base de Datos
Agregar columnas a la tabla `orders`:
- `preferred_delivery_date` (date) — fecha ideal de entrega
- `preferred_time_slot` (text) — "mañana" o "tarde"
- `payment_method` (text) — "efectivo" o "transferencia"

Agregar a `app_settings` una clave `estimated_delivery_days` (valor por defecto "1-2") para gestionar dinámicamente el tiempo de entrega estimado desde el admin.

#### 2. Checkout Mejorado (Carrito.tsx)
Después de los campos actuales (nombre, teléfono, dirección, barrio, notas), agregar:
- **Tiempo estimado de entrega**: badge dinámico que lee `estimated_delivery_days` de `app_settings` (ej: "Entrega en 1-2 días hábiles")
- **Fecha preferida de entrega**: selector de fecha (solo días hábiles futuros, mín. según estimado)
- **Horario preferido**: selector "Mañana (8am-12pm)" / "Tarde (2pm-6pm)"
- **Método de pago**: botones "Efectivo" / "Transferencia"

#### 3. Edge Function (send-whatsapp-order)
Actualizar para recibir y guardar los nuevos campos (`preferred_delivery_date`, `preferred_time_slot`, `payment_method`) en la orden. Incluirlos en el mensaje de WhatsApp.

#### 4. Admin — Gestión de Tiempo de Entrega
En `SettingsTab.tsx`, agregar campo editable para `estimated_delivery_days` (texto libre, ej: "1-2", "24h", "Mismo día").

#### 5. Admin — Pedidos (OrdersTab.tsx)
Mostrar en cada tarjeta de pedido: fecha preferida, horario y método de pago con iconos claros.

#### 6. Modo Catálogo / Compartir
Agregar botón "Compartir producto" en `ProductoDetalle.tsx` usando `navigator.share()` o copiando URL al portapapeles. Esto permite a comerciales enviar enlaces directos por WhatsApp.

### Archivos a Modificar
- Nueva migración SQL (3 columnas en `orders` + setting)
- `src/pages/Carrito.tsx` — formulario de checkout ampliado
- `supabase/functions/send-whatsapp-order/index.ts` — nuevos campos
- `src/components/admin/SettingsTab.tsx` — campo delivery time
- `src/components/admin/OrdersTab.tsx` — mostrar nuevos datos
- `src/pages/ProductoDetalle.tsx` — botón compartir

