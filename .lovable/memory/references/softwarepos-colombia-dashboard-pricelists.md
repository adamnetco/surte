---
name: SoftwarePOS Colombia (POSCOL) — Admin dashboard & Listas de Precios
description: Extensión 15 capturas POSCOL: módulo dashboard tipo grid de tarjetas con icono+título+descripción, CRUD completo Listas de Precios (crear, modificar, administrar por cliente con override precio/margen), Kits de Artículos (combos con precio venta + impuesto + items), apertura caja, contacto soporte. Eduardo destaca limpieza del panel administrativo.
type: reference
---

# POSCOL — Admin Dashboard & Listas de Precios (extensión)

15 capturas adicionales de POS Colombia. Eduardo destacó **claridad del panel administrativo**.

## CAP 13 — Dashboard Admin (la joya)
Pantalla bienvenida `Bienvenido(a) a POS Colombia. ¡Haz click en algún módulo, para empezar!`

Layout: **grid de 6 tarjetas iguales** (3×2):
1. Ventas — "Procesar venta y registrar"
2. Tarjetas de Regalo — "Agregar, modificar y buscar tarjetas de regalo"
3. Kits de Artículos — "Agregar, modificar y buscar Kits de artículos"
4. Listas de Precios
5. ...
6. ...

Cada tarjeta = icono grande + título h3 + descripción 1-línea. Hover sutil. **Cero menús laterales** — el dashboard ES el menú.

**Por qué funciona**:
- Onboarding instantáneo: el usuario nuevo no se pierde en sidebar.
- Cognitive load mínimo (Hick's Law): 6 opciones grandes vs 30 ítems sidebar.
- Mismo patrón Stripe Dashboard / Square Dashboard.

**Réplica SistecPOS** (admin):
- En `/admin` (route raíz), reemplazar landing actual por **module grid 3×N tarjetas shadcn `<Card>`** con `lucide` icono 48px + título + descripción 1-línea.
- Tarjetas filtradas por rol (Editor no ve "Configuración").
- Sidebar colapsable disponible pero **no por defecto** en desktop ancho.

## CAPs 05-12 — CRUD Listas de Precios (completo)

### Administrar listas (CAP 05)
- Tabla simple: nombre lista | tipo (margen / precio fijo) | productos asociados | acciones.
- Botón "+ Nueva lista" arriba-derecha.

### Crear / Modificar lista (CAP 10, 11, 12)
Form vertical compacto:
- **Nombre** (text)
- **Almacenamiento** (select: por margen / por precio fijo)
- Si margen: `Margen aritmético a partir del [select: precio venta / costo / precio compra]`
- Si precio fijo: `Precio venta` (number)
- Campo `opcional` (descripción)
- Modificar: header muestra ID `Modificar lista de precios: 1562`

Patrón: **el tipo (margen vs precio) cambia los campos visibles** — radio group switching, no tabs.

### Administrar precios por cliente (CAP 06, 07)
- `Administrar precios: CLIENTES` (lista todos los clientes con lista asignada).
- `Administrar precios: [nombre lista]` → tabla productos × precio override.
- Inline edit por celda (presunto, OCR no clarifica).

**Validación contra decisión Eduardo (mem://decisions/pos-architecture-answers #6)**:
- ✅ POSCOL ya hace cliente↔lista↔producto como Eduardo definió.
- ✅ Soporta margen automático **a partir de costo / precio compra / precio venta** → 3 modos de cálculo.
- ➕ Agregar a SistecPOS: opción `margen` con base seleccionable (no solo precio fijo).
- ➕ Copy "Almacenamiento" de POSCOL es confuso → usar "Modo de cálculo" en SistecPOS.

## CAPs 01, 03 — Kits de Artículos (combos)

### Lista de Kits (CAP 01)
- Tabla con `+ Nuevo Kit` arriba-derecha.

### Modificar Kit (CAP 03)
Form vertical:
- `+ Agregar Artículo` botón (autocomplete búsqueda)
- Lista items añadidos: ANILLO DE CERA CON GUÍA NETUSA / ANILLO DE CERA SIN GUÍA COFLEX / SEVILLA
- Cantidad por item
- `Precio Venta` (override total del kit)
- `Impuesto` (selector)

**Insight**: el kit tiene precio propio **independiente** de la suma de componentes (clave para combos restaurante "Hamburguesa+Papas+Bebida $25.000" donde no se cobra suma).

**Réplica SistecPOS**:
- Tabla `product_kits (id, name, price, tax_id)` + `product_kit_items (kit_id, product_id, qty)`.
- Restar stock de componentes al vender kit (BOM simple).
- En POS: el kit aparece como un producto más, expandible para mostrar componentes.

## CAP 04 — Agregar Artículo a Kit
Modal simple con search (`compra` parece "compra" filtro). Patrón típico autocomplete.

## CAP 14 — Apertura caja (ya documentada en POSCOL patterns previo)
Confirma: 1 input cantidad + select moneda. Friction-zero.

## CAP 15 — Soporte
Página final estática con datos de contacto del soporte. **No aplica a SistecPOS** (tenemos floating WhatsApp).

## CAPs 08, 09 — Listados secundarios
OCR poco legible, parecen reportes/listados estándar.

## CAP 02 — Selector Impuesto en form artículo
Dropdown simple con tipos de impuesto. Patrón básico.

## Resumen — qué incorporar a SistecPOS
| Patrón POSCOL | Acción SistecPOS | Prioridad |
|---|---|---|
| Dashboard admin = grid de módulos 3×N | Rediseñar `/admin` landing como `<ModuleCard>` grid | **Alta** (mejora onboarding) |
| Listas de precios con modo margen + base | Agregar a `price_lists.calculation_mode` (`fixed` / `margin_on_cost` / `margin_on_purchase` / `margin_on_sale`) | Media |
| Kits con precio propio + BOM componentes | Tablas `product_kits` + `product_kit_items` | Media |
| Form switching radio (margen vs fijo) | Patrón react-hook-form `watch()` | aplica al implementar |
| "Modo de cálculo" en vez de "Almacenamiento" | Mejorar copy | aplica al implementar |

## Anti-patrones POSCOL reiterados
- Confirm dialog nativo del navegador (ya documentado).
- Textos cortados / mal alineados en captures (font-size demasiado pequeño).
- Sin breadcrumb claro.
- Sin estados loading/empty visibles.

## NOTA: faltan capturas reales de Cabal-app
Las 15 URLs de esta tanda eran POSCOL extra. Pedir a Eduardo subir tanda de Cabal-app cuando esté disponible.
