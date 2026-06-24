---
name: UltimatePOS / SuperPos Kosari — UX patterns
description: 13 capturas UltimatePOS (Laravel SaaS open-source base "Kosri-V8.4"). Workspace POS dense con header `Ubicación|Cliente|+`, ticket footer con Borrador/Cotización/Suspender/Venta+Tarjeta/Efectivo, Descuento/Impuesto/Envío/Gastos en línea inline, módulo restaurante con KDS "Todos los pedidos" en tarjetas (cocinas), recibo térmico con productos+pago+nota, dashboard "Ventas últimos 30 días", lista productos con imagen+ubicación+precio+stock+tipo. Anti-patrón: estética genérica Bootstrap admin sin diferenciación.
type: reference
---

# UltimatePOS / Kosari (SuperPos v8.4) — Análisis UX

13 capturas. UltimatePOS es el base open-source (Laravel + CodeIgniter) que muchos vendedores empaquetan como SaaS. Kosari es una variante con módulo restaurante.

## Patrones observados

### 1. POS workspace (CAPs 01, 04, 06, 08, 13)
Layout estándar Bootstrap admin con:
- **Header ticket**: `Ubicación | Cliente sin cita previa | + Agregar gasto`
- **Footer ticket en bloque inline** muy completo:
  - `Descuento % (-)` / `Impuesto de pedido (+)` / `Envío (+)` / `Cargo de embalaje (+)` → todos editables en línea
  - `Artículos: 2.00 | Total: 2.250,00 | Total Pagadero: 2.025,00`
  - Botones: `Borrador | Cotización | Suspender | Venta + Tarjeta | Efectivo`

**Insight**: Suspender = pausa de ticket (cumple función del multi-ticket de Alegra, pero **es modal/serial, no pestañas en paralelo**). Borrador y Cotización separan documento legal.

### 2. KDS "Todos los pedidos - Cocinas" (CAP 11) — útil
Tarjetas en grid mostrando:
- Número pedido + fecha/hora
- Cliente / Mesa / Ubicación / Estado pedido
- Botón **"Marcar como cocido"** por tarjeta
- Footer: "SuperPos Kosri-V8.4"

Patrón simple, comparable a tu KDS actual. Sin colores por tiempo (gap vs VectorPOS).

### 3. Recibo térmico (CAP 05)
Estructura ordenada:
```
Fecha: 08/02/24    Factura: 40009    Tabla: Tabla 3
Estado: Pago final previa     Personal: Sr Kevin

Productos:
# | Producto | Descuento | Precio inc imp | Total parcial
1   Pasta Carbonara     1.00 × 13.75   0.00   13.75

Información de pago:
Total / Descuento / Cargo embalaje / Orden Impuestos / Total pagado / Total restante

Nota de venta:       Nota del personal:
```

**Insight**: incluye **dos notas separadas** (cliente vs interno). Útil para HORECA.

### 4. Lista productos (CAP 03)
Columnas: imagen | acción | ubicación empresa | precio compra | precio venta | stock actual | tipo producto.
Densidad alta, tabla horizontal scrollable.

### 5. Dashboard (CAP 12)
Una sola tarjeta grande "Ventas últimos 30 días $864.00" + filtro fecha.
**Demasiado vacío** para un dashboard real. Anti-patrón.

## Fortalezas a considerar
- **Suspender ticket** como concepto: bueno para HORECA donde se cierra cuenta más tarde
- **Bloque inline de Descuento+Impuesto+Envío+Embalaje** en footer del ticket — muy compacto
- **Dos notas en recibo** (cliente vs personal)
- **Tres tipos de documento al cerrar**: Borrador / Cotización / Venta — separa intención

## Anti-patrones (NO copiar)
- Estética Bootstrap admin genérico, sin identidad
- Dashboard pobre (1 métrica)
- Tablas horizontales scrolleables sin responsive
- Footer con copyright visible al usuario final
- Versión visible en UI (`Kosri-V8.4`) — innecesario en producción
- Idioma mixto Spanish/English ("Total Payable" + "Total Pagadero")
- Sin atajos teclado documentados

## Conclusión
UltimatePOS es **base funcional pero estéticamente débil**. Lo único realmente valioso para SistecPOS:
1. Concepto **Suspender ticket** (alternativa serial al multi-ticket Alegra)
2. **Footer inline** con descuento/impuesto/envío/embalaje en una línea
3. **Dos notas** en recibo HORECA
4. Tres documentos de cierre: Borrador / Cotización / Venta

El resto ya está mejor resuelto por Alegra/Cabal.
