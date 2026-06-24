---
name: Alegra POS — UX patterns, multi-venta, atajos teclado, comandas cocina
description: 15 capturas pos.alegra.com — pestañas múltiples ventas simultáneas (Venta 1 / Venta 2 / +), atajos teclado completos (F4 venta simple, alt+P efectivo, alt+E producto, alt+R devolución, alt+B buscar), Factura Electrónica DIAN nativo con Documento Equivalente POS, Comandas cocina con mesas+meseros+propinas, Lista precios + Numeración + Método pago + Centro costo + Cliente en header ticket, Crear producto sidesheet con detalles inventario multi-bodega, descuentos globales modal, historial ventas master-detail. Modelo de referencia para SistecPOS por nivel de madurez fiscal Colombia.
type: reference
---

# Alegra POS — Análisis UX detallado

15 capturas `pos.alegra.com`. **Benchmark más maduro** del entrenamiento — Alegra es el competidor #1 según project knowledge.

## Stack visual
- Header verde-azulado característico Alegra (`#0F766E` aprox)
- Sidebar izquierdo angosto con iconos + tooltip (collapsed por defecto)
- Cards grandes coloridas para productos con imagen + nombre + precio
- Tipografía sans Inter-like, espaciados generosos
- Esquinas redondeadas `rounded-md`, sombras sutiles
- Layout responsive web (PWA-ready)

## Patrones de flujo destacados

### 1. **Múltiples ventas simultáneas** (CAPs 01, 02, 03, 06) — KILLER FEATURE

Footer del POS muestra **tabs de ticket**: `🛒 Venta principal | 🛒 Venta 2 | 🛒 Venta 1 | +`

Cada tab = un ticket independiente en estado intermedio. El cajero puede:
- Atender cliente A, ponerlo en pausa, atender B, volver a A
- Sin perder el carrito ni reabrir mesa
- Comparable a las pestañas del navegador

**SistecPOS hoy**: solo soporta 1 ticket activo en `/pos`.

**Réplica SistecPOS** (alta prioridad):
- State manager `useTicketStash` con array de tickets activos
- Footer `<TicketTabs>` con `+` para nuevo, X para descartar
- Persistencia en `localStorage` (sobrevive refresh)
- Confirmación al cerrar caja si hay tickets pendientes
- Atajo `Ctrl+T` nuevo ticket, `Ctrl+W` cerrar, `Ctrl+1..9` cambiar

### 2. **Atajos de teclado completos** (CAP 04)

Modal "Atajos para vender":
- **F4** — Venta simple
- **Alt+P** — Gestión de efectivo
- **Alt+E** — Crear producto
- **Alt+C** — Crear cliente
- **Alt+R** — Devolución
- **Alt+V** — Facturar
- **Alt+B** — Buscar productos
- **Alt+N** — Código de barras

**Insight**: el cajero experto **no toca el mouse**. Diferencia entre vender 20 vs 50 tickets/hora.

**Réplica SistecPOS**:
- Tu `usePOSHotkeys` ya existe — auditar cobertura vs esta lista
- Modal `?` overlay listando atajos (shadcn `<CommandDialog>`)
- Hint discreto `[F4]` junto a botones principales

### 3. **Header del ticket — densidad inteligente** (CAPs 01-03, 06)

En 1 fila compacta arriba del listado:
```
[Lista de precios ▾] [Numeración FVENZ24-FEETO ▾] [Método pago: Efectivo ▾] [Centro de costo ▾] [Cliente: Consumidor final ▾]
```

5 selects en línea, cada uno con default sensato. Cambiar default no requiere modal.

**Réplica SistecPOS**:
- Header ticket actual está disperso → consolidar en barra horizontal
- Defaults persistentes por usuario (`user_pos_preferences`)
- Numeración DIAN como selector (FVE / Doc Equivalente POS)

### 4. **Facturación electrónica DIAN nativa** (CAP 05) — diferenciador fiscal

`/configuraciones/facturas` con 3 toggles principales:
- **Documento equivalente POS electrónico** ✅ Activado
- **Facturación electrónica** ✅ Activada
- **Documentos electrónicos sin internet** — "Sigue facturando cuando pierdas conexión" → ticket provisional que se convierte en FE al recuperar internet

**Insight crítico**: el modo offline-first **ya está en tu mem://features/offline-first-pos**. Alegra lo tiene como bandera visible y configurable, no implícito.

Banner persistente arriba en POS (CAP 06, 10, 12, 14):
`¡Activa la creación de documentos electrónicos sin internet! Si pierdes tu Internet, al vender generaremos un ticket provisional que se convertirá en factura electrónica cuando tengas conexión`

**Réplica SistecPOS**:
- Banner upsell similar para activar Innapsis DIAN si org no lo tiene
- Toggle visible "Modo offline activo" en header POS
- Indicador estado conexión + cola pendiente sincronización

### 5. **Crear producto — sidesheet con secciones colapsables** (CAPs 07, 08, 09)

Modal lateral derecho (sidesheet, no full-modal) con secciones expandibles:
- **Información general** (tipo producto/servicio/combo, nombre, categoría)
- **Detalles de inventario** (multi-bodega: Principal/Bodega2 con cantidad inicial/min/max por bodega)
- **Listas de precios** (override por lista)
- **Venta en negativo** toggle (vender sin stock disponible)
- **Campos adicionales** (selector qué campos personalizar)
- **Configuración contable** (cuenta de ingresos)
- **Datos para facturas exportación** (partida arancelaria, marca, modelo)

**Insight**: secciones colapsables ocultan complejidad al 80% que solo necesita nombre+precio. El experto expande lo que necesita.

**Réplica SistecPOS**:
- Refactor `ProductFormDialog` actual a sidesheet con `<Accordion>` shadcn
- Sección base siempre abierta (nombre/precio/categoría)
- Resto colapsado por defecto
- Multi-bodega: cantidad por almacén en tabla compacta dentro de la sección
- "Venta en negativo" toggle = importantísimo para mayoristas

### 6. **Descuentos globales modal** (CAP 10)

Modal "Descuentos globales":
- "Añade descuentos a todos los ítems de una venta de forma fácil y rápida"
- Selector tipo (% o $) + valor
- Aplica a todo el ticket sin tocar item por item

**Réplica SistecPOS**:
- En footer ticket POS: botón "Descuento global" + modal simple
- Recalcular en tiempo real total

### 7. **Historial de ventas — master-detail** (CAP 11)

Layout 50/50:
- **Izquierda**: lista facturas con código, cliente, total, estado, fecha
- **Derecha**: detalle factura seleccionada (info DIAN, datos generales, productos vendidos en tabla)

Click en factura → detalle se actualiza sin recarga. Mantiene contexto.

**Réplica SistecPOS**:
- Ya tienes `/admin/historial`; verificar que sea master-detail no nav full-page
- Mostrar info DIAN (CUFE, estado emisión) en detalle

### 8. **Ventas recientes en POS** (CAP 12)

Modal lateral derecho que reemplaza temporalmente el grid productos:
- Tabs `Hoy | Esta semana | Anteriores`
- Lista facturas recientes con botón rápido "Imprimir / Anular / Devolución"
- `Ver historial de ventas →` para ir al backoffice

**Insight**: el cajero puede consultar/anular sin abandonar `/pos`.

**Réplica SistecPOS**:
- Atajo `Alt+H` o icono en sidebar POS → sheet "Ventas recientes"

### 9. **Configuración de venta** (CAP 13)

Sección "Venta rápida" con:
- **Método de pago predefinido** (Efectivo)
- **Vendedor por defecto** (Eduardo Tobacia)

Auto-aplicación de defaults en cada ticket nuevo → menos clicks repetitivos.

**Réplica SistecPOS**:
- `user_pos_preferences` table con `default_payment_method_id`, `default_seller_id`, `default_warehouse_id`, `default_price_list_id`

### 10. **Pedidos de cocina / Comandas / Mesas / Meseros** (CAP 15) — HORECA completo

Sidebar config muestra módulo HORECA estructurado:
- **Distribución de mesas** — "Ordena tus mesas, crea meseros y define qué se prepara en cocina"
- **Personalizar mesas**
- **Gestión de meseros**
- **Comandas** — "Organiza los pedidos de cocina y qué productos requieren preparación"
- **Propinas** — "Recibe y contabiliza propinas en la venta" + cuenta contable asociada

**Insight**: Alegra trata HORECA como módulo opcional activable. No infla el POS general.

**Réplica SistecPOS**:
- Ya tienes mesas/KDS/comandas/propinas separados — auditar que sean toggle ON/OFF a nivel organización
- Tipo de negocio (HORECA / Retail / Servicios) define qué módulos arrancan activos

### 11. **Productos como cards visuales** (CAPs 10, 12, 14)

Grid 5-6 columnas, cada producto:
- Imagen cuadrada (placeholder coloreado si falta)
- Nombre 2 líneas
- Precio destacado abajo
- Hover sutil

Modelo intermedio entre tiles XL VectorPOS y lista densa POSCOL. **Mejor para retail variado** (no inventario gigante, no menú restaurante puro).

### 12. **Tipo de producto: Producto / Servicio / Combo** (CAP 09)

Switch al crear: 3 opciones radio.
- Servicio: no rebaja stock
- Combo: BOM con componentes (≈Kits POSCOL)

**Réplica SistecPOS**:
- `products.type enum ('product', 'service', 'combo')` (probablemente ya está)
- Combo dispara tablas `product_kit_items`

## Resumen — prioridades de adopción

| Patrón Alegra | Acción SistecPOS | Prioridad |
|---|---|---|
| Múltiples tickets simultáneos | `useTicketStash` + `<TicketTabs>` footer | **CRÍTICA** (mayor gap vs Alegra) |
| Modal de atajos completo | `<HotkeysHelpDialog>` overlay `?` | **Alta** |
| Header ticket 5 selects en línea | Refactor `<TicketHeader>` | **Alta** |
| Sidesheet crear producto + accordion | Refactor `ProductFormDialog` | Alta |
| Ventas recientes sheet en POS | Botón sidebar POS | Media |
| Descuentos globales modal | Footer ticket | Media |
| Defaults venta por usuario | `user_pos_preferences` | Media |
| Banner upsell offline DIAN | Si org sin Innapsis activo | Media |
| Venta en negativo toggle producto | Campo `allow_negative_stock` | Media |
| Multi-bodega en producto sidesheet | Sección "Detalles inventario" | Media |
| Cards productos imagen+precio | Ya cubierto | OK |
| HORECA como módulo toggle | Auditar ya implementado | Verificar |

## Comparación cruzada FINAL

| Criterio | VectorPOS | POSCOL | Cabal | Alegra | SistecPOS objetivo |
|---|---|---|---|---|---|
| Multi-ticket simultáneo | No | No | No | **Sí ✅** | Copiar Alegra |
| Atajos teclado documentados | Parcial | No | No | **Sí ✅** | Copiar Alegra |
| FE DIAN nativa | Sí | Sí | ? | **Sí ✅** | Innapsis (ya) |
| Modo offline DIAN visible | No | No | No | **Sí ✅** | Banner upsell |
| Crear producto sidesheet+accordion | Tabs | Modal plano | ? | **Sí ✅** | Copiar Alegra |
| Historial master-detail | Sí | No | ? | **Sí ✅** | Ya |
| HORECA módulo opcional | Sí (default) | No | ? | **Sí ✅** | Toggle por org |
| Multi-org | Limitado | No | Sí | Sí | Ya |
| Multi-bodega en producto | ? | ? | ? | **Sí ✅** | Implementar |
| Pestañas múltiples ventas | No | No | No | **Sí ÚNICO** | **GAP CRÍTICO** |

## Anti-patrones Alegra
- Densidad informativa alta puede abrumar al cajero novato (mitigado por defaults)
- Sidebar collapsed por default oculta navegación → tooltips obligatorios
- Modales sobre modales en flujos largos (crear producto desde dentro de venta → modal apilado)
- Algunos textos con encoding raro en OCR sugieren bugs i18n

## NOTA roadmap
**El gap #1 de SistecPOS vs Alegra es múltiples tickets simultáneos en POS**. Ningún otro competidor analizado (Vector/POSCOL/Cabal) lo tiene. Implementarlo nos pone por encima inmediatamente.
