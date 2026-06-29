# SoftwarePOS / POS Colombia — Batch 1 (9 capturas)

Origen: SoftwarePOS Colombia (https://www.poscolombia.com) — competidor directo, modelo "web app legacy bonito". Capturas en `.lovable/refs/softwarepos-batch1/`.

## El patrón clave que reclama el usuario: **TOP RIBBON ICONOGRÁFICO PERSISTENTE**

Ribbon superior FIJO con **9 íconos XL etiquetados** siempre visibles, ordenados por frecuencia de uso operativo:

`Clientes · Artículos · Kits de Artículos · Proveedores · Reportes · Compras · Ventas (F2) · Tarjetas de Regalo · Listas de Precios`

Características críticas:
- **1 clic = cualquier sección** (vs nuestro sidebar colapsable que requiere abrir → buscar → clic).
- Cada ícono tiene **etiqueta debajo** (no solo glyph): el usuario lee, no adivina.
- **Ventas (F2)** marcado con atajo de teclado en el label.
- Anchura fija ~80px por ícono, alto ~70px, gradiente sutil + ícono dimensional. Ribbon ocupa ~10% del viewport vertical.
- No hay sidebar; el ribbon **reemplaza** la navegación lateral.

VectorPOS (batch 1 anterior) usa el mismo patrón. SitricPOS (batch 4) también. **Es consenso del sector POS retail/food en Colombia**.

## Vista Ventas (caps 07, 08, 09) — home por defecto, contextual

Layout vertical apretado bajo el ribbon:
1. **Fila contextual** (4 selectores en línea): `L. precios: CLIENTES ▾` · `Vend: Usuario Pos ▾` · `Ventas Suspendidas` (botón) · `Modo de Registro: Venta ▾`. **Todo lo configurable de la venta actual, en una fila.**
2. **Tabs de búsqueda** `Buscar artículos | Buscar por referencia`.
3. **Search bar XL** con botón lupa + botón inline `Artículo Nuevo +` (verde, crea producto sin salir).
4. **Tabla ticket** con columnas: Artículo · CodArtículo · Stock · Precio · Cant · Desc % · Total. Precio/Cant/Desc son **editables inline** (input dentro de la celda).
5. **Panel derecho cliente + totales** apilados:
   - `Seleccionar Cliente (Opcional)` con autocomplete + botón `Cliente Nuevo +` inline.
   - Resumen: Cantidad artículos, Subtotal, IVA%, **Total** (banda naranja XL).
   - `Cantidad a pagar` (amarillo), selector `Agregar pagos: Efectivo / Tarj. Regalo / Tarjeta de Débito / Tarjeta de crédito / Crédito` con input monto, comentarios y botón verde `Agregar pago`.
6. **Acciones rápidas inline** (texto + ícono, no botones grandes): `Cerrar Caja | Realizar Pago en Efectivo | Teclas de acceso rápido`.
7. Cuando hay cliente seleccionado, panel muestra nombre + cédula + email + **puntos acumulados** (1891 pts) con botones `Editar / Quitar`.

→ **Crear/buscar entidades sin salir del POS** es el segundo patrón clave: `Cliente Nuevo +` y `Artículo Nuevo +` abren modal/inline, no navegan.

## Reportes (caps 01, 02, 03, 04)

Cada reporte es una página separada del ribbon (Reportes → submenú dropdown probable):
- **Resumen por impuestos** (rango fecha + tipo venta → tabla + Excel)
- **Resumen por proveedor** (rango + tipo → tabla Subtotal/Impuesto/INCBP/Total/Ganancia, **footer pegado con totales agregados destacados**)
- **Resumen por caja / Cierre Z** (formato comprobante texto plano: Documento inicial/final, Total Facturas, Devoluciones, Anuladas, valor por tarifa IVA, **Medios de Pago tabla Efectivo/Tarjeta con valor y transacciones**, total)

Patrón consistente: filtros simples (Rango Fecha radio "Hoy" o personalizado, Tipo Venta combo, botón verde "Generar reporte"), salida tabular + botón azul "Descargar archivo Excel". **Cero gráficos.** Pragmático.

→ **Gap nuestro:** Nuestro `/admin/reportes` actual tiene cards bonitas con charts, pero un cajero/admin tradicional quiere **listado plano + Excel**. Ofrecer **vista "Clásica" toggle** en cada reporte (tabla + Excel) además de la moderna.

## Tarjetas de Regalo (cap 05)

Sección propia en ribbon. Lista plana: Número Tarjeta · Valor · Nombre del cliente · acción editar. Toolbar: `+ Nueva Tarjeta de Regalo · Borrar · Exportar a Excel · Generar código de barras`. Búsqueda XL arriba a la derecha.

→ **Gap nuestro:** No tenemos gift cards. Slice futuro: módulo `gift_cards` con número, saldo, cliente asignado, código de barras, movimientos (carga/redención).

## Footer/license (caps 06)

- Footer permanente: `Bienvenido(a) Usuario Pos | Salir` izquierda, **reloj XL + día/mes** derecha, **íconos de notificaciones** (campana/globo con badge contador).
- Modal de renovación con días restantes ("Te queda 27002 días") + botón `Renovar ahora`.
- **"Esto es un demo. Algunas funciones pueden estar deshabilitadas"** banner amarillo en cada pantalla en modo trial.

→ **Reusable:** banner trial/demo + reloj XL en footer + modal pre-vencimiento (ya tenemos dunning, pero falta el modal in-app friendly).

## Verdad incómoda sobre nuestro POS actual

Hoy en `/pos/vender` el usuario tiene que:
- Abrir sidebar → buscar "Clientes" → clic → navegar → volver al ticket (pierde contexto)
- O usar Cmd+K (Ola 4) — pero **el operador POS senior NO usa Cmd+K**, quiere botón visible

**Conteo de clics SistecPOS hoy vs SoftwarePOS:**
| Acción | SistecPOS | SoftwarePOS | Δ |
|---|---|---|---|
| Ir a Clientes | 2 (abrir sidebar + clic) | 1 (clic ribbon) | -1 |
| Crear cliente desde venta | 4 (sidebar→clientes→nuevo→form→volver) | 1 (botón inline en panel) | -3 |
| Ir a Reportes | 2 | 1 | -1 |
| Ir a Artículos | 2 | 1 | -1 |
| Suspender venta | 3 (menú contexto) | 1 (botón siempre visible) | -2 |
| Cambiar lista precios | 3 | 1 (selector top) | -2 |

→ **Objetivo:** llegar a paridad o mejor que SoftwarePOS en clics para acciones operativas frecuentes.

## Propuesta concreta — Slice "POS TopRibbon + Contextual Bar"

**Insertarlo ANTES** del workspace por nicho (que asumía sidebar). El ribbon se vuelve la nueva navegación primaria en TODAS las rutas `/pos/*`, no solo Vender.

### Componentes nuevos
- `POSTopRibbon.tsx` — barra horizontal sticky con íconos XL etiquetados configurable por nicho (ver tabla abajo).
- `POSContextualBar.tsx` — fila de selectores justo bajo ribbon (Lista precios, Vendedor, Modo registro, Ventas suspendidas).
- `POSQuickCreate.tsx` — modal universal para "Cliente Nuevo / Artículo Nuevo / Proveedor Nuevo" sin salir del POS.
- `POSRibbonSlot` config — DB-driven (tabla `pos_ribbon_config` por org/role).

### Items del ribbon por business_type

| Ítem | retail | food | hybrid | services | pharmacy |
|---|---|---|---|---|---|
| Vender (F2) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mesas | — | ✅ | — | — | — |
| Agenda | — | — | — | ✅ | — |
| Clientes (F3) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Artículos (F4) | ✅ | ✅ | ✅ | — | ✅ |
| Recetas/BOM | — | ✅ | ✅ | — | — |
| Proveedores (F5) | ✅ | ✅ | ✅ | — | ✅ |
| Compras (F6) | ✅ | ✅ | ✅ | — | ✅ |
| Reportes (F7) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Caja (F8) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tarjetas Regalo | opcional | opcional | opcional | opcional | — |
| Listas Precios | ✅ | — | ✅ | — | — |
| KDS | — | ✅ | — | — | — |
| Producción | — | opcional | ✅ | — | — |
| Más ▾ (overflow) | ✅ | ✅ | ✅ | ✅ | ✅ |

Cada ítem expone un atajo `Fn` y se renderiza solo si `isModuleEnabled()` lo permite. Items ocultos van al menú `Más ▾`.

### Atajos teclado
F2 Vender · F3 Clientes · F4 Artículos · F5 Proveedores · F6 Compras · F7 Reportes · F8 Caja · F9 Mesas/Agenda · F10 Guardar · F11 Buscar · F12 Cobrar.

Hook nuevo `usePOSHotkeys()` registra los Fn globalmente y muestra cheat-sheet con `?`.

## Veredicto del plan (actualizado)

**Reordenar fases:**

### Fase 0 — Limpieza tenant (urgente, lo pediste)
- D0. **Tenant Settings Registry** (`organization_settings` único). Limpia hardcodes SurteYa/Bucaramanga/Cárnicos restantes. Migra `organizations.*` dispersos a registry.
- D1. Auditoría grep `surteya|Bucaramanga|Cárnicos|Pulpas|Panificados|mayorista` → cero coincidencias.

### Fase 1 — Navegación POS (NUEVO, lo pediste hoy)
- N1. **POSTopRibbon + ContextualBar + QuickCreate** (1-clic a todo, paridad SoftwarePOS).
- N2. Hotkeys F2-F12 + cheat-sheet `?`.
- N3. Ribbon DB-driven configurable por nicho/rol.

### Fase 2 — UX táctil workspace (los 8 slices previos)
Slice 1+6 floor-map food · Slice 2 sale tabs · Slice 3 Action Rail XL · Slice 4 Payment Tiles XL · Slice 5 Customer Display 7-seg · Slice 7-8 retail/services strips.

### Fase 3 — Capacidades transversales (5 slices batch 4)
B1 Permission Matrix · B2 Recetas+Producción · B3 IpoConsumo+lotes · B4 Cierre Z oficial · B5 Catálogo por nicho.

### Fase 4 — Nichos nuevos
C1 pharmacy · C2 services con slices propios.

### Fase 5 — Gift Cards (batch SoftwarePOS hoy)
G1. Módulo `gift_cards` con número, saldo, cliente, código de barras, movimientos.
G2. Pago tipo `gift_card` en POS.
