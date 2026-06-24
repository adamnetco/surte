---
name: POS Architecture Decisions (Vector batch-3 answers)
description: Decisiones de Eduardo sobre canales, KDS multi-rol, auto-save, listas de precios y stacking de impuestos para SistecPOS Core. Fuente única de verdad para implementación.
type: feature
---

# Decisiones de arquitectura POS (respuestas a Vector batch-3)

Contexto: respuestas dadas tras analizar VectorPOS settings + KDS. Aplican a SistecPOS Core en todas las próximas iteraciones.

## 1. Central de Domicilios = canal de primer nivel ✅
- Página dedicada con UX/UI enfocada **100% en agilidad** para un cajero que solo recibe domicilios.
- Impacta `orders.channel` → valor `central_domicilios` distinto a `mesa`, `mostrador`, `domicilio`, `marketplace`.
- No reutilizar el POS-mesas; layout propio: lista de pedidos entrantes a la izquierda, captura rápida cliente+dirección a la derecha, productos abajo con búsqueda agresiva (autocomplete + hotkeys numéricas).
- Métricas en vivo: tiempo promedio toma-pedido, pedidos por hora.

## 2. MarketPlace = ecommerce/menú virtual (Ola.click style) ✅
- **No es Rappi/Didi/iFood**. Es el ecommerce propio (ya hay desarrollo adelantado) que recibe pedidos de clientes directos vía WhatsApp y se sincroniza al POS en paralelo.
- Optimizar el ecommerce existente para handoff WhatsApp + POS unificado.
- Modelo de referencia: **Ola.click** (menú QR → carrito → WhatsApp Business → orden en POS).
- `orders.channel = 'marketplace'`, separado de Central de Domicilios.

## 3. Vale de Anulación a cocina ✅ (incluir desde pre-pilot HORECA)
- Cuando se anula una comanda, **debe imprimirse un recibo "ANULADO"** automáticamente en la impresora de la estación de producción correspondiente.
- Objetivo: evitar errores de producción (que sigan preparando algo ya anulado).
- Disparador: cambio de estado `comanda → anulada` con `printed_at IS NOT NULL` en cocina/parrilla/bebidas.
- Plantilla térmica 80mm con banner grande "ANULADO" + items + mesa/ticket + hora + usuario que anula.

## 4. KDS device role picker = MULTI-ROL ✅
- Un dispositivo puede tener varios roles simultáneos (ej: Caja + KDS).
- Login del dispositivo presenta checkboxes (no radio).
- Persistir en `device_settings.roles jsonb[]`.
- UI consecuente: navegación condicional según roles activos.

## 5. Auto-save en pantallas de Config ✅
- Sin botón "Grabar". Debounce 600ms tras cambio.
- Indicador discreto "Guardado · hace 2s" en header.
- Toast solo en errores.
- Excepción: pantallas con cálculos derivados (impuestos, listas de precios con recalcular masivo) mantienen botón explícito "Aplicar cambios a productos".

## 6. Listas de precios — modelo cliente↔lista↔producto ✅
- Usuario admin **crea sus propias listas** (no las 4 fijas de VectorPOS).
- Cada lista se asocia a clientes (`client.price_list_id`).
- Cada lista define overrides por producto: `price_list_items (price_list_id, product_id, price, discount_pct)`.
- Al facturar: el sistema toma automáticamente la lista del cliente; si no tiene, usa precio base.
- UI: gestor de listas con duplicar / importar CSV / copiar de otra lista. Tabla virtualizada (cliente Restoque tiene 8k+ productos).
- **NO** copiar el modo "Preguntar precio por producto" de VectorPOS.

## 7. Múltiples impuestos stacking (IVA + INC + otros) ✅
- HORECA requiere acumular impuestos (IVA 19% + INC 8% + Bolsa + Propina sugerida no-impositiva).
- Crear **Gestor Avanzado de Impuestos**:
  - Tabla `taxes (id, code, name, rate, type, dian_code, stacking_order)`.
  - Tabla pivote `product_taxes (product_id, tax_id, override_rate)`.
  - Función calc en orden de stacking (cascada o suma según `tax.calculation_mode`).
- UI gestor:
  - Lista drag-to-reorder con preview en vivo "Producto $10.000 → +IVA 19% → +INC 8% → Total $13.190".
  - Aplicación masiva: "Aplicar este impuesto a categoría X" con conteo previo.
  - Validación DIAN: code obligatorio antes de facturar electrónicamente.
- Giros DIAN típicos que requieren stacking:
  - Restaurantes / bares (IVA 19% + INC 8%)
  - Licores (IVA + IC departamental)
  - Combustibles (IVA + sobretasa)

## Resumen para roadmap
| Decisión | Tabla/columna impactada | Prioridad |
|---|---|---|
| Central Domicilios canal | `orders.channel` enum + `/central-domicilios` route | Q1 post-pilot |
| Marketplace = ecommerce propio | reusar ecommerce, channel='marketplace' | en curso |
| Vale anulación cocina | EF print + plantilla | **pre-pilot HORECA** |
| KDS multi-rol | `device_settings.roles[]` | Slice KDS |
| Auto-save config | hook `useAutoSaveConfig` | Refactor Settings |
| Listas precios cliente | `price_lists`, `price_list_items`, `clients.price_list_id` | Q1 |
| Gestor impuestos stacking | `taxes`, `product_taxes`, `tax.stacking_order` | pre-pilot HORECA |
