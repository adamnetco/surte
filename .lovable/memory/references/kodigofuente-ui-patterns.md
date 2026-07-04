---
name: Kodigo Fuente — UI Patterns (Facturación)
description: Análisis de captura oficial Facturación Kodigo Fuente + estética Windows-flat de referencia para simplicidad radical (nicho supermercados Colombia)
type: reference
---

# Kodigo Fuente — Patrones UI (Facturación)

**Fuente:** captura oficial `Facturación` (Autoservicio XYZ) + docs.kodigofuente.com/docs/manual-pos.
**Nicho:** supermercados en Colombia. Positioning: "Ágil / Práctico / Intuitivo — NO somos software, somos un aliado". Meta: reducir 25% los tiempos.

## Anatomía de la pantalla (top→bottom, left→right)

```
┌─ Facturación ─────────────────────────────────────────────────────────────┐
│ Factura N°  000 15   [ $ Pagar ][ ✱ Otros ][ ↑ Cargar ][ ↓ Archivar ]     │
│ Usuario     ADMIN                                        [ ↩ Salir ]      │
│ Cliente     [CONSUMIDOR FINA ⓘ]                Total Bases  $ 0,00        │
│                                                Total Ivas   $ 0,00        │
│                                                            $ 0,00 (XL)    │
├───────────────────────────────────────────────────────────────────────────┤
│ CÓDIGO │ PRODUCTO/SERVICIO   │ %IVA │ PRECIO │ CANTIDAD │ TOTAL │ [-1 F8]│
│                                                                  [+1 F9] │
│  (grid vacío — celdas alternando muy claro y blanco)             ─────── │
│                                                              [BORRAR LNA]│
│                                                              ┌─┬─┬─┐    │
│                                                              │7│8│9│    │
│                                                              ├─┼─┼─┤    │
│                                                              │4│5│6│    │
│                                                              ├─┼─┼─┤    │
│                                                              │1│2│3│    │
├──────────────────────────────────────────────────────────┐   ├─┴─┼──┤    │
│ [FRUTAS] VARIOS VERDURAS DULCES BEBIDAS PANES LACTEOS    │   │ 0 │EN│    │
│ ← subrayado rojo bajo pestaña activa (single line)       │   ├───┼──┤    │
├──────────────────────────────────────────────────────────┤   │F5 │← │    │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐  Tiles 5-col   │   ├───┴──┤    │
│ │foto  ││foto  ││foto  ││foto  ││foto  │  altura ~40vh  │   │REIMPRIM│    │
│ │$1.800││$5.000││$1.300││$3.000││ $800 │                │   │VER PRE.│    │
│ │UVA   ││UVA   ││MARAC ││PAPAYA││CARAN │                │   └────────┘    │
│ └──────┘└──────┘└──────┘└──────┘└──────┘                │                │
├──────────────────────────────────────────────────────────┴────────────────┤
│ 0 Registros en lista           Estación 1     Licencia AUTOSERVICIO XYZ   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Reglas visuales que definen la estética "Kodigo"

1. **Cromatismo mínimo.** Blanco + azul (#1B6BC8 aprox) + rojo suave sólo para el underline de pestaña activa. Cero degradados, cero sombras, cero glassmorphism.
2. **Botones outline con icono+label vertical.** Todos los botones primarios de la barra superior (Pagar, Otros, Cargar, Archivar, Salir) son cuadrados con **borde azul 1px**, icono azul XL arriba y label mayúscula debajo. Mismo tamaño = mismo peso visual — no hay jerarquía por color, hay jerarquía por posición.
3. **Header 3 líneas** izquierda: Factura N°, Usuario, Cliente. La info operacional siempre visible sin abrir menú.
4. **Totales top-right en 3 niveles** (Bases pequeño / IVAs pequeño / TOTAL XXL azul-oscuro). Numpad físico usa la misma alineación de totales.
5. **Grid tabular XL (6 columnas) domina el 60% de la pantalla.** Las filas usan zebra ultra-suave (blanco / #F7FAFC). No hay chips, no hay avatars, no hay iconos por línea.
6. **Numpad on-screen a la derecha, permanentemente visible.** Botones 60×60px mínimo con label numérico + hotkey (F8/F9/F5). ENTER es un botón 2u de ancho, azul outline igual que el resto.
7. **Tira de pestañas de categorías con underline rojo.** Una sola línea, sin scroll, sin iconos, sólo texto uppercase. La pestaña activa lleva un **underline rojo 3px** — es el único acento cálido de toda la pantalla.
8. **Tiles de producto simples:** foto real cuadrada 1:1, precio grande a la izquierda arriba, nombre uppercase debajo. Sin badges de stock, sin descuento, sin favorito. Foto real "de mercado" (no ilustración).
9. **Status bar inferior gris con 3 datos:** contador de líneas · Estación N · Licencia autorizada a XXX. Info admin permanente, jamás modal.
10. **Todo hotkey se muestra en el propio botón** (F8, F9, F5, ⌫). No hay hotkeys secretas.

## Contraste con estilos previos analizados

| Sistema | Estilo dominante | Densidad | Color |
|---|---|---|---|
| **VectorPOS** | Workspace 4-paneles, tiles color-coded, XL price display | Alta densidad, muchos widgets | Azul + verde/naranja por status |
| **SitricPOS legacy** | Ribbon 8 módulos + Action Rail 8 botones color | Muy alta, ribbon dominante | 8 colores accent (uno por módulo) |
| **SoftwarePOS** | Top-ribbon XL persistente + Quick-Create inline | Media, ribbon reemplaza sidebar | Azul dominante, colores por estado |
| **Kodigo Fuente** | Grid tabular + numpad + tiles + pestañas underline | **Mínima. Sólo lo que se usa AHORA** | **Sólo azul outline + 1 acento rojo** |

**Insight clave:** Kodigo NO usa color como código semántico. Usa **posición** (top-right = totales, right column = numpad, bottom-left = catálogo) y **tipografía** (XL = importante ahora, sm = referencia). Todos los demás POS analizados dependen de color para status/priority.

## Cómo trasladarlo a SistecPOS Core (guía de aplicación)

- **POSTopBar**: convertir las acciones principales a **botones outline azul cuadrados con icon+label vertical, tamaño uniforme** (siguiendo lo iniciado en Slice 2 — extenderlo a Pagar/Otros/Cargar/Archivar/Salir con estética Kodigo).
- **Header 3 líneas**: mover `POSCustomerPicker`, `Factura N°` y `Usuario` a una columna vertical top-left en lugar del strip horizontal actual.
- **Numpad permanente**: promover el `Numpad.tsx` (creado en Slice 1) a **columna derecha fija visible** — no como sheet emergente sino como panel siempre presente, con los mismos hotkeys en pantalla.
- **Underline rojo en pestaña activa** de `POSCategoryTabs` (reemplazar el pill/chip actual).
- **Reducir la paleta operativa**: revisar tokens semánticos en `index.css` — mantener `--success #76B833` y `--alert #F37021` sólo para toasts y badges, NO como fondos primarios. Fondos primarios de operación → siempre blanco + azul outline.
- **Zebra ultra-suave en el ticket** (que ahora es zebra fuerte gris) — reducir al 2-3% de opacidad como Kodigo.
- **Sacar iconos por línea del ticket.** La captura Kodigo tiene grid puro sin StickyNote/Percent/Trash por línea; esos botones viven en la fila de acciones abajo y actúan sobre la línea seleccionada. Esto reduce ruido visual masivamente.

## Referencias

- Captura oficial: `/tmp/kodigo/user-image.png`
- Docs: https://docs.kodigofuente.com/docs/manual-pos/facturacion/Facturacionypagosenposelectr%C3%B3nico
- Landing: https://kodigofuente.com — mockup "tools-screen" con la misma estética
