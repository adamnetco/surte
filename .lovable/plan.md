## Plan de Implementación

### 1. Migración de Base de Datos
Crear tablas nuevas:
- `coupons` — códigos promocionales con descuento %, monto fijo, fecha de expiración, uso máximo
- `product_presentations` — presentaciones de venta (unidad, pack, caja) con factor de conversión y precio
- `custom_scripts` — scripts de terceros inyectables en header/body/footer

### 2. Panel de Código de Terceros (Admin → Ajustes)
- Sección en SettingsTab para gestionar scripts personalizados (header, body, footer)
- Componente `CustomScriptInjector` que lee de `app_settings` e inyecta los scripts dinámicamente
- Soporte para Google Merchant Widget y Google Customer Reviews

### 3. Google Merchant Center + Reviews
- Integrar el widget de insignias de Merchant Center (merchant_id: 5758181755)
- Integrar Google Customer Reviews opt-in en la página de confirmación de pedido
- Mostrar comentarios de Google Maps en la tienda (embed de reseñas)

### 4. Presentaciones de Producto
- UI en admin para crear presentaciones (Unidad, Pack x10, Caja x40) con precio y peso
- Selector en ProductCard y ProductoDetalle para elegir presentación
- CartContext actualizado para guardar `presentation_id`
- Vista de picking/desglose de inventario en admin

### 5. Cupones de Descuento
- CRUD en admin para gestionar cupones
- Campo de cupón en checkout con validación en tiempo real
- Descuento aplicado al total antes de enviar pedido

### Orden de ejecución:
1. Migración DB (todas las tablas juntas)
2. Panel de scripts + Google integrations
3. Presentaciones de producto
4. Cupones
