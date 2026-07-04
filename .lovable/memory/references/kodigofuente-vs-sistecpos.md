---
name: Kodigo Fuente vs SistecPOS Core — Gap analysis y hoja de ruta simplicidad
description: Comparativo de simplicidad Kodigo vs SistecPOS + VectorPOS + SitricPOS + SoftwarePOS; qué copiar, qué ignorar, ruta pragmática
type: reference
---

# Kodigo Fuente vs SistecPOS Core — Gap analysis

**Contexto:** el usuario descubrió Kodigo Fuente y quedó impactado con su simplicidad. Objetivo: llevar SistecPOS Core a esa misma limpieza sin sacrificar las capacidades omnichannel (ecommerce + WhatsApp + multi-tenant).

## Ranking de simplicidad (subjetivo, basado en capturas y docs)

| Rank | Sistema | Densidad UI | Curva aprendizaje | Aspiracional |
|---|---|---|---|---|
| 🥇 | **Kodigo Fuente** | Mínima. Grid + numpad + tiles + status bar. Sin ribbon. | Muy corta (docs de 1-2h para operar). | **SÍ — norte estético** |
| 🥈 | VectorPOS | Media-alta. Workspace 4-paneles pero limpio. | Media. | Parcial — el price display XL y tiles color-code |
| 🥉 | SoftwarePOS | Media. Top-ribbon XL + quick-create. | Media-corta. | Parcial — hotkeys F2-F12 y ribbon persistente |
| 4️⃣ | SitricPOS legacy | Alta. Ribbon 8 módulos + Action Rail 8 colores. | Larga. | NO — para SistecPOS es demasiado |
| 5️⃣ | **SistecPOS actual** | Alta (tabs, sheets, popovers, badges por línea) | Media, pero fricción visual | **Simplificar hacia Kodigo** |

## Qué copiar de Kodigo (ordenado por impacto)

### Alto impacto — visual / percepción de simplicidad

1. **Paleta ultra-reducida.** Blanco + azul outline + un solo acento rojo puntual para "activo/selección". Retirar success/warning/alert de la UI operativa; dejarlos sólo en toasts.
2. **Botones outline uniformes** (top-bar y numpad). Mismo tamaño, mismo peso, mismo color. Diferenciación por posición, no por color.
3. **Numpad on-screen permanente en columna derecha** — no sheet emergente. Con hotkeys F5/F8/F9 impresas en los botones.
4. **Underline rojo 3px bajo pestaña activa** (reemplaza chip/pill actual en `POSCategoryTabs`).
5. **Sacar acciones por línea del ticket** (StickyNote/Percent/Trash inline) — moverlas a una fila de acciones abajo que actúa sobre la línea seleccionada.
6. **Zebra ultra-suave (2-3% opacity)** en el grid del ticket.
7. **Tiles de producto sin badges de stock/descuento** — sólo foto + precio + nombre.

### Impacto medio — arquitectura de flujos

8. **Header 3 líneas top-left permanente**: Factura N° / Usuario / Cliente. Info operacional siempre visible.
9. **Cliente default "Consumidor Final"** sin fricción — arrancar SIEMPRE con default, cambiar con `Ctrl+F`.
10. **3 caminos por acción** (mouse + hotkey + TAB). Ya tenemos F2 en Cobrar → extender a todo botón operativo.
11. **Pattern "un formulario, dos modos"** (buscar/crear) en `POSCustomerPicker`.
12. **Ctrl+O como shortcut universal para "Otros"** (notas crédito/débito, cortesías, cotizaciones).

### Impacto bajo — nice-to-have

13. **Peso manual con tecla `+`** en el campo código (patrón elegante para báscula manual sin abrir modal).
14. **Ventas con `Enter × N`** patternizadas — muscle memory para el cierre.
15. **Editor visual de Pestañas/Botones** en configuración.

## Qué NO copiar (dónde SistecPOS ya está mejor)

- **Configuración requiere reinicio.** Kodigo tolera esto porque es desktop nativo — SistecPOS es web, hot-reload es esperable. Mantener nuestro modelo reactivo.
- **Separación radical POS/Admin en dos manuales.** SistecPOS multi-tenant SaaS necesita transiciones fluidas entre operar y administrar (el mismo user con rol admin lo hace 20 veces/día). Mantener sidebar unificada con permisos.
- **Sólo nicho supermercado.** SistecPOS Core cubre food/retail/hybrid/services. Las herramientas condicionales por `business_type` son un diferenciador — no perderlas.
- **Solo desktop Windows.** SistecPOS es PWA offline-first, mobile-first strict. Nuestra ventaja competitiva.
- **Sin omnichannel.** Kodigo no tiene ecommerce, WhatsApp Flow, agente IA, storefront headless. Todos son ventajas propias de SistecPOS a preservar.

## Comparación cruzada con VectorPOS / SitricPOS / SoftwarePOS

| Feature | Kodigo | VectorPOS | SitricPOS | SoftwarePOS | SistecPOS actual |
|---|---|---|---|---|---|
| Numpad permanente | ✅ | ❌ (modal) | ❌ | ❌ | ⚠️ Sheet (Slice 1) |
| Hotkeys impresas en botón | ✅ (F5/F8/F9/⌫) | Parcial | ✅ (F2-F12) | ✅ | ⚠️ Sólo F2 en COBRAR |
| Paleta ≤ 2 colores UI operativa | ✅ | ❌ | ❌ (8 colores) | ⚠️ | ❌ (multi-token) |
| Underline pestaña activa | ✅ | ❌ (pill) | ❌ | ❌ | ❌ (pill) |
| Tiles producto foto+precio+nombre | ✅ | ✅ (+badges) | ✅ (+badges) | ✅ (+chips) | ✅ (+ modifiers/discounts) |
| Fabricante > Marca > Categoría | ✅ | ✅ | ✅ | ⚠️ | ❌ (sólo Category+Brand) |
| Peso manual con `+` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ctrl+O = Otros (nota crédito/etc) | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Editor visual de Pestañas/Botones | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Cliente "Consumidor Final" default | ✅ | ✅ | ✅ | ✅ | ✅ |

## Hoja de ruta pragmática (3 sprints)

### Sprint A — Estética Kodigo aplicada (frontend puro, sin DB)

- [ ] Reducir paleta operativa en `POSWorkspace`: bg blanco puro, botones outline azul uniformes.
- [ ] Convertir `POSCategoryTabs` a underline rojo bajo pestaña activa (retirar pill).
- [ ] Mover acciones por línea (StickyNote/Percent/Trash) del `TicketLineRow` a una **fila única "Acciones sobre línea seleccionada"** abajo del ticket.
- [ ] Zebra 2% en filas del ticket + tipografía tabular más grande.
- [ ] Tiles producto: quitar chips/badges de stock, dejar sólo foto/precio/nombre.
- [ ] `Numpad` promovido a columna derecha permanente (retirar `qtySheetOpen` — la edición pasa a ocurrir *inline* en el numpad).

### Sprint B — Hotkeys y muscle memory

- [ ] Cada botón operativo con su hotkey visible: Otros=Ctrl+O, Cargar=Ctrl+L, Archivar=Ctrl+S, Salir=Ctrl+Q, F8/F9 en numpad.
- [ ] `Ctrl+F` desde catálogo abre `POSCustomerPicker`.
- [ ] `ESC` como alias de F2 para Cobrar.
- [ ] `↑↓ + Backspace` en el ticket para eliminar línea sin tap.
- [ ] Patrón "Enter × N" en `PaymentDialog` — cadencia consistente.

### Sprint C — Estructura de datos y admin

- [ ] Esquema: agregar `manufacturers` y `brands` como entidades separadas de `categories`.
- [ ] Editor visual de pestañas y orden de tiles (`POSTabsEditor`) en admin.
- [ ] Peso manual con `+` en `POSScannerListener` cuando `useBalanza` está activo.
- [ ] Migrar feature flags dispersos a `Configuración → Sistema` visible.

## Aplicabilidad por nicho

- **Supermercados / Autoservicios** (nicho Kodigo): copiar todo casi 1:1 — es exactamente su caso de uso.
- **Restaurantes (food)**: mantener workspace de mesas y KDS, pero aplicar la estética Kodigo al cobro final (numpad + underline + paleta reducida).
- **Retail moda/tech**: aplicar la simplicidad Kodigo, mantener modificadores y variantes que son propias del nicho.
- **Servicios**: aplicar la simplicidad Kodigo + eliminar catálogo (usar quick-create de servicio inline).
- **Farmacia**: aplicar Kodigo + mantener alertas de receta y sustitutos.

## Referencias cruzadas

- `mem://references/vectorpos-ui-patterns`
- `mem://references/vectorpos-backoffice-flows`
- `mem://references/vectorpos-settings-kds`
- `mem://references/sitricpos-batch4-legacy-desktop`
- `mem://references/softwarepos-batch1-top-ribbon`
- `mem://references/kodigofuente-ui-patterns` (esta serie)
- `mem://references/kodigofuente-pos-flows`
- `mem://references/kodigofuente-config-hierarchy`

Docs completas descargadas y analizadas: 64 páginas de docs.kodigofuente.com + 7 páginas de kodigofuente.com. Sitemap agotado.
