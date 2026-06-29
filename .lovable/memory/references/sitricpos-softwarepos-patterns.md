---
name: SitricPOS + SoftwarePOS Online + Alegra POS UX patterns
description: Análisis 15 capturas (img1-15) de competidores: Alegra POS (cloud), SoftwarePOS.online, SitricPOS (desktop), VectorPOS. Patrones por tipo de negocio para refactor de /pos/vender.
type: reference
---

# Capturas analizadas (Jun 2026)

## Alegra POS cloud (img1, img2)
- Layout 2 columnas: catálogo grid (cards con foto + nombre + precio + ⭐ favorito) | right rail 320px con factura.
- Right rail: Lista de precio · Numeración · Método de pago · Cliente (Consumidor final por defecto) · Lista vacía con icono carrito · Footer "Vender $0" full-width verde.
- Top header: nombre tab "Facturar" + chip "Disponible" (online) + Atajos teclado + nube sync.
- Sidebar app vertical 56px con avatares de tiendas (multi-tenant).
- Filtros: Categorías + Ordenar por (selects).

## SoftwarePOS.online (img3, 4, 5, 6, 7)
- **Multi-ticket tabs estilo "VENTA 1 NUEVO / VENTA 2 / CLIENTES"** (color naranja/azul/teal) — permite suspender venta y cambiar de ticket en 1 clic. Crítico.
- Top: ARTÍCULO NUEVO | input barcode | MOSTRAR/OCULTAR ARTÍCULOS toggle | dropdown tipo doc (VENTA/COTIZACIÓN).
- Botón TOTALIZAR (verde grande) + CREAR COTIZACIÓN + CLIENTES en barra de acciones.
- Tabla items: Nombre | Precio Venta (editable) | Tiers | Cantidad | Descuento | Total + 🗑.
- Right rail: Información de Cliente (foto + e-mail/WhatsApp checkboxes para envío) · Resumen de venta (Tiers artículo, N° artículos, Subtotal, Total $XXX, Cantidad a pagar) · Agregar Pago (efectivo/mixto) · COMPLETAR VENTA verde.
- Strip categorías horizontal con icono + label (Alisados, Ampollas, Shampoo, Tratamientos... en negocios de salón).
- Modal de **Atajos teclado**: F1 Venta sin datos · F3 Venta con datos · F5 Suspender · F6 Desuspender · F7 Búsqueda por serial · Ctrl+1 Cancelar · Ctrl+2-6 Tiers/Desc/Descripción/Comentarios.
- Sidebar vertical íconos compactos (Ayuda en rojo, OFFLINE en verde como toggle visible).
- Pie: Desc toda Venta, Impuesto personalizado, Abrir cajón monedero, Generar TXT, vendedor select.

## SitricPOS desktop (img9, 13, 15)
- **Pantalla cliente XL "cobro"**: 3 bloques 7-segment digital (azul Total, verde Recibido, rojo Cambio) ocupan toda la pantalla. UX visible desde lejos para el cliente. Imprimir Sí/No esquina.
- **Venta keyboard-first**: input barcode arriba, tabla densa (Cod, Nombre, Cant, Valor Kg/Ud, Medida, Valor_Prod, %, Iva, Desc) + right rail de **botones con etiqueta F-key visible** (F4 X Salir, F5 Consultar, F6 Seleccionar, F7 Borrar, F8 Asignar Cliente, F9 Enviar a Memoria, F11 Consulta Facturas, F12 Gastos, F3 Abono Cliente, **Fin Venta** verde XXL).
- Total $XXL en footer permanente.

## SitricPOS Restaurante (img10)
- **Floor map de mesas** (4x5 grid) con icono mesa+sillas, badge verde/rojo Disponible/Ocupado, nombre EDUARDOTP del mesero.
- Right rail acciones: Venta Libre · Domicilio · Cambio Mesa · Abono Cliente · Consulta Factura · Pagos · X Salir (rojo). Flecha verde grande "siguiente".

## VectorPOS (img11)
- Layout 2 col: **acciones laterales con barras verticales de color saturado** (Comentario verde · Descuento naranja · Multiplicar magenta · Borrar rojo) | grid productos con tile (Precio header verde con $, nombre debajo).
- Header categoría "PRODUCTOS" verde, productos con tile cuadrado.

## Pago (img12)
- **Grid 3 col de medios de pago como tiles XL** (140x60+) con brand icon real + nombre en bold: TARJETA · MIXTO · EFECTIVO · CUPO · UBER · DOMICILIOS · NEQUI · DAVIPLATA · BANCOLOMBIA · RAPPI · ATRAS (rojo). Configurable: el admin agrega/oculta y reordena.

## Cliente fidelización (img14)
- Form datos cliente + bloque "Puntos_Redimidos / Puntos_Disponibles" + botón **Redimir Puntos** verde con icono regalo + historial compras tabla.

# Gaps identificados vs SistecPOS actual (/pos/vender)
1. **Falta multi-ticket visible**: hoy `VENTA 1/2/3` está en RecentActionsPopover, debería ser tabs always-on.
2. **Falta vista cliente XL "cobro"**: el modal de pago actual es chico; competidores lo muestran a pantalla completa para que el cliente confirme.
3. **Payment tiles XL configurables**: hoy es lista; debería ser grid de tiles brand-iconográficos.
4. **Hotkeys visibles en botones**: hoy los atajos están sólo en modal "?"; competidores ponen "F4", "F5" pintado en el botón mismo.
5. **Floor map para `food`**: ya existe `/mesas` pero la entrada por defecto en `/pos/vender` para food debería ser el plano, no el catálogo.
6. **Strip de categorías visual con icono**: hoy es lista plana; competidores usan strip horizontal con ícono + label.
7. **Acciones laterales coloreadas**: Comentario/Descuento/Multiplicar/Borrar como columna lateral fija (estilo VectorPOS).
8. **Right rail factura**: hoy se solapa con cart; alinear con patrón Alegra (Lista precio · Numeración · Cliente · Cart vacío con hint · Vender XL).

# Recomendaciones por business_type (mapping)
| business_type | Vista por defecto `/pos/vender` | Modos visibles | Right rail | Atajos clave |
|---|---|---|---|---|
| `food` | Floor map (`MesasPanel`) | Mesa, Domicilio, Consumo Interno, Venta Libre | Comanda activa por mesa | F2 cambiar mesa, F8 suspender |
| `retail` / `minimarket` | Catálogo + barcode | Autoservicio, Domicilio | Factura (Alegra style) | F3 venta c/datos, F5 suspender |
| `services` (salón/spa) | Strip de servicios + agenda mini | Mesa(=cabina), Consumo Interno | Cliente obligatorio + historial | F8 cliente, F1 agenda |
| `hybrid` | Toggle Mostrador / Domicilio (50/50 hero) | 4 modos | Factura + tracking domicilio | F4 modo, F7 buscar |

# Componentes nuevos a crear
- `POSSaleTabs.tsx` — tabs multi-ticket VENTA 1/2/3 always-on.
- `POSPaymentTilesXL.tsx` — grid configurable de tiles de pago con brand icons.
- `POSCustomerDisplay.tsx` — pantalla XL "cobro" estilo 7-segment, abrible en segunda pantalla o overlay full.
- `POSActionRail.tsx` — columna lateral coloreada Comentario/Descuento/Multiplicar/Borrar/Suspender con F-key visible.
- `POSCategoryStrip.tsx` — strip horizontal con icono + label, paginable.
- `POSWorkspaceByType.tsx` — switch por `business_type` que decide el layout inicial.

# Constraints
- No replicar look "Windows 95" de Sitric (7-segment azul/verde/rojo está OK SOLO para customer display, no para POS interno).
- Mantener stack: shadcn + Tailwind, no fugas a estilos imperativos.
- Configurable: el admin elige tiles de pago, atajos y modos por tipo de negocio (usar `pos_enabled_modes` ya existente + nueva `pos_payment_tiles`).
