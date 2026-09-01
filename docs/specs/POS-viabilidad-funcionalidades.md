# Viabilidad de funcionalidades tipo "POS local completo" — qué hay y qué falta

Estado a 2026-09-01. Base: SistecPOS Core (React + Supabase + Electron,
arquitectura hexagonal, offline-first con Dexie).

Leyenda: ✅ listo · 🟡 parcial · ⛔ falta

| # | Funcionalidad | Estado | Qué existe hoy | Qué falta |
| --- | --- | --- | --- | --- |
| 1 | Venta por código de barras o nombre | ✅ | `POSScannerListener` (emulación teclado), búsqueda por nombre/SKU/GTIN en catálogo | Nada crítico |
| 2 | Créditos, apartados, plan separe, puntos | 🟡 | Puntos: `loyalty_programs/accounts/movements`. Cartera SaaS: `dunning_*` | Tabla `layaways` (apartados) + abonos, y cartera de cliente en POS (crédito por tercero, cupo, estado de cuenta) |
| 3 | Imágenes de producto | ✅ | `product_media` (multi-imagen, orden, fallback), `image_url` | Nada |
| 4 | Comisiones de vendedores | ⛔ | Solo comisiones FX (casas de cambio) | Reglas por vendedor/categoría (`commission_rules`), acumulado por venta y reporte de liquidación |
| 5 | Suscripciones (a clientes) | 🟡 | `subscriptions` del SaaS (planes de tenant) | Suscripciones de cliente final: recurrencia, cobro periódico, entregas programadas |
| 6 | Tallas, tamaños, colores, sabores, marcas, referencias | 🟡 | `brands`, `modifier_groups/options` (sabores/adiciones), `product_presentations` (presentaciones B2B) | Variantes reales tipo matriz (talla × color) con SKU y stock por variante |
| 7 | Usuarios con privilegios diferentes | ✅ | `user_roles` + `has_role`, `admin_section_access`, RLS, PIN + auto-lock, auditoría | Afinar permisos POS granulares por acción (descuento máximo, anular) |
| 8 | Funciona sin internet | 🟡 | Dexie: catálogo cacheado + outbox (`pos_order`, `payment`, `stock`, `einvoice`) con reintentos | Cobertura offline de clientes/precios por lista y resolución de conflictos de stock |
| 9 | Venta por peso en báscula | ⛔ | Puerto de hardware definido; agente local solo imprime | Adaptador WebSerial/agente para leer peso y precargar cantidad |
| 10 | Caducidades y lotes | ⛔ | `stock_movements`, `product_stock` sin lote | Tablas `product_lots` (lote, vencimiento, costo) + selección FEFO en venta y alertas |
| 11 | Inventarios y stock bajo | ✅ | `product_stock`, `stock_movements`, transferencias, conteo físico, alertas inteligentes | Nada crítico |
| 12 | Reporte de ventas y ganancias | ✅ | Reportes admin, `cost_price` → margen (semáforo 15/25%), cierre Z | Comparativos por vendedor una vez existan comisiones |
| 13 | Control de gastos | 🟡 | Contabilidad (`journal_entries`, `accounting_accounts`), movimientos de caja | Pantalla simple de "gastos" del negocio con categorías y adjunto |
| 14 | Pago a proveedores | 🟡 | `suppliers`, `purchase_orders`, `invoice_scans` | Cuentas por pagar: vencimientos, abonos y estado por proveedor |
| 15 | Factura tirilla POS con logo | ✅ | `pos_receipt_templates` (80/58 mm, logo, canales) + print-agent ESC/POS | Nada |
| 16 | Cotizaciones PDF y por correo | 🟡 | `pos_quotes`, PDF de factura, infra de correo (Resend) | Envío de la cotización por correo con PDF adjunto en un clic |
| 17 | Hasta 10 tipos de precio por producto | ✅ | `price_lists` + `price_list_items`, precios detal/mayorista/distribuidor | Selector rápido de lista en POS ya existe; sin pendientes |
| 18 | Sistema de control local | ✅ | Electron (ventana propia, GPU, sin throttling), print-agent 9101, licencia Ed25519 + fingerprint, releases versionadas | Nada; ver `docs/desktop/slice-5-tauri-decision.md` |

## Orden recomendado (mayor valor / menor riesgo)

1. **Lotes y caducidad** (#10) — tabla nueva + FEFO; no toca lo existente.
2. **Apartados y crédito de cliente** (#2) — cierra el flujo de cartera.
3. **Comisiones de vendedores** (#4) — reglas + reporte; solo lectura sobre ventas.
4. **Variantes talla × color** (#6) — el cambio más invasivo: stock por variante.
5. **Báscula** (#9) — adaptador de hardware aislado tras el puerto existente.
6. **Cotización por correo** (#16) y **gastos** (#13) — incrementales pequeños.

Cada punto se implementa como slice independiente: puerto en `core/ports`,
adaptador en `infrastructure/database`, UI en `presentation`/módulo, con
migración que incluya `GRANT` + RLS.
