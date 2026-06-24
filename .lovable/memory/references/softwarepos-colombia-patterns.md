---
name: SoftwarePOS Colombia (POSCOL) UX patterns
description: Análisis de 9 capturas POSCOL — apertura caja minimal, grid productos densidad alta, atributos artículos, create article form con cálculo de % ganancia bidireccional, historial inventario por lote, confirm dialogs nativos. Fortalezas competitivas: simplicidad y claridad en flujos. Inspiración prioritaria para SistecPOS según Eduardo.
type: reference
---

# SoftwarePOS Colombia (POSCOL) — Patrones UX/UI

**Fuente**: 9 capturas softwarepos.co (demo público, banner "Esto es un demo, algunas funciones pueden estar deshabilitadas").
**Por qué entrenar aquí**: Eduardo destaca **simplicidad y claridad de flujo** como ventajas a replicar.

## Stack visual observado
- Header rojo corporativo `#C12027` aprox + texto blanco "POS COLOMBIA".
- Fondo blanco puro, sin sombras pesadas. Plano.
- Tipografía sans estándar (Arial/Helvetica), tamaños conservadores 12-14px.
- Botones primarios cuadrados, color rojo o verde según semántica.
- Footer fijo gris claro con: usuario, hora, fecha → siempre visible (anclaje temporal para cajero).

## Patrones de flujo destacados

### 1. Apertura de caja (CAP 07)
- **Una sola pregunta**: "Por favor ingrese una cantidad de apertura para entrar en el registro de ventas".
- Un input numérico + select moneda + botón.
- Sin wizard, sin recordatorios opcionales. **Fricción mínima** para abrir turno.
- Banner amarillo persistente "demo, funciones deshabilitadas" — patrón claro de modo demo.
- **Réplica para SistecPOS**: modal único `/pos/abrir-caja` con foco automático en input, Enter = abrir.

### 2. Grid de productos con densidad ultra-alta (CAP 11, 12)
- Tarjetas pequeñas (~140×80px) con: nombre arriba, precio derecha, código/SKU pequeño abajo.
- 4-5 columnas × muchas filas visibles sin scroll.
- **Categorías a la izquierda** como tabs verticales (DOSCOL, PRUEBAS, etc.) — filtra grid en click.
- No imágenes (texto puro). Para inventarios largos (5k+ ítems) esta densidad supera al modo "tiles XL" de VectorPOS.
- **Réplica**: Vista "modo lista" toggleable en `/pos` grid productos para ferreterías/farmacias (vs modo "tiles" para restaurantes).

### 3. Confirm dialog nativo del navegador (CAP 10)
- "softwarepos.co dice: ¿está seguro de que...?" → `window.confirm()` puro.
- Coincide con la regla de memoria SistecPOS (`window.confirm` para acciones destructivas admin). **Validar regla**.

### 4. Form Crear Artículo (CAP 13, 14) — gran fortaleza
Layout en grid 2 columnas dentro de un modal/page:
- Precio venta + impuesto en la misma fila
- **Campo "Porcentaje de ganancia"** con checkbox `[ ] usar porcentaje` → cálculo bidireccional precio↔costo↔ganancia
- Tipo identificación + número documento (proveedor)
- Descripción libre
- Toggles inline:
  - `[ ] El artículo es número de serie / Es un servicio`
  - `[ ] Maneja lotes y fechas de vencimiento`
  - `[ ] Genera CUFE` (electrónico)
- Stock mínimo siempre visible
- Botón único "Guardar" abajo

**Mejor que VectorPOS** porque:
- Cálculo de margen en tiempo real (Eduardo ya tiene esto en `mem://features/profitability-analysis`).
- Toggles agrupados por concepto, no en pestañas separadas.
- **Anti-patrón a evitar**: labels apretados y poco contraste — corregir con espaciado Tailwind `space-y-4`.

### 5. Atributos de artículos (CAP 09)
- Página dedicada con select "tipo de atributo" + tabla de valores.
- Variantes manejadas como atributos compuestos (color × talla).
- Patrón estándar Shopify/Magento. Aplicable cuando se agreguen variantes.

### 6. Historial de inventario por lote (CAP 15) — fortaleza
- Vista master-detail: lote arriba (código, categoría), tabla movimientos abajo.
- Columnas: fecha, tipo (importación archivo / ajuste / venta), usuario, cantidad, observación.
- **Trazabilidad completa** sin necesidad de exportar.
- **Réplica**: `/admin/inventario/:productId/historial` con timeline + filtros tipo movimiento.

### 7. Selector "Cómo vas a utilizar este dispositivo" (CAP 02 — VectorPOS pero relevante)
- Dos botones grandes: "Pantalla de cocina" / "Caja1".
- Decisión binaria al iniciar app. **Multi-rol contradice esto** → en SistecPOS usar **checkboxes** (decisión #4).

## Fortalezas competitivas a replicar
| Patrón POSCOL | Por qué | Aplicación SistecPOS |
|---|---|---|
| Apertura caja 1-input | Cero fricción | `/pos/abrir-caja` |
| Grid alta densidad sin imágenes | Velocidad para SKU largo | Toggle vista lista/tiles |
| Cálculo margen bidireccional | Productor entiende su negocio | Ya en perfil; extender a `ProductFormDialog` |
| Toggles inline en form | Reduce clicks vs tabs | Rediseñar `ProductsTab` modal |
| Historial inventario master-detail | Trazabilidad sin export | `/admin/inventario/:id/historial` |
| Banner modo demo persistente | Onboarding sin fricción | Modo demo trial 14 días |

## Anti-patrones a NO copiar
- Estética visual obsoleta (años 2010, bordes duros, sin states hover claros).
- Sin responsive (todo desktop-first, escritorio fijo).
- Sin atajos de teclado visibles.
- Sin breadcrumb ni jerarquía clara en admin.
- Sin dark mode.
- Confirm nativo del navegador en flujos clave (usar AlertDialog shadcn).

## Comparación rápida vs VectorPOS
| Criterio | VectorPOS | POSCOL | SistecPOS objetivo |
|---|---|---|---|
| Apertura caja | Wizard 3 pasos | 1 input | 1 input + recordatorios opcionales |
| Densidad grid | Tiles XL color | Listas densas | Toggle según giro |
| Crear artículo | Tabs separadas | Single form + toggles | Single form modular |
| Historial inventario | Reporte filtros | Master-detail in-line | Master-detail + timeline |
| Multi-rol device | Single picker | Single picker | **Multi-rol checkboxes** |
| Estética | Plano gris industrial | Plano rojo básico | Flat moderno, neutral + accent SistecPOS |
