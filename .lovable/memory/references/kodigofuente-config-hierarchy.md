---
name: Kodigo Fuente — Jerarquía Configuración + Estructura de Módulos
description: Los 8 dominios de configuración y la jerarquía Fabricante→Marca→Categoría→Pestaña→Botón; también módulos POS/Admin
type: reference
---

# Kodigo Fuente — Configuración y estructura de módulos

## Menú principal (panel azul izquierdo, letra inicial = hotkey)

`F` Facturación · `T` Terceros · `R` Reportes · `A` Administración · `H` Herramientas · `S` Sistema · Salir.

Cada módulo se abre pulsando la **tecla que corresponde a la letra inicial**. Sin submenús flotantes — cada módulo abre su propio workspace.

## Sistema > Configuración → 8 dominios

Todos los cambios requieren **reinicio de la app**. Diseño explícito: la config es infrecuente, la operación es frecuente — se optimiza la operación.

1. **Configuración general** — datos de negocio (razón social, NIT, régimen bloqueados post-creación).
2. **Estaciones** — administración por terminal/POS.
3. **Productos y servicios** — jerarquía completa (ver abajo).
4. **Facturación** — reglas globales + Balanza (por estación).
5. **Usuarios y seguridad** — CRUD usuarios, niveles "Usuario" vs "Administrador".
6. **Sistema** — feature flags (`Permitir ventas con precio cero`, etc.).
7. **Envío de documentos electrónicos** — kill switch global on/off.
8. **Habilitaciones electrónicas** — DIAN + POS electrónico (prefijo, resolución, rango numeración).

## Jerarquía de organización de productos (5 niveles)

```
Fabricante
  └── Marca                    ← categoriza + filtra, muestra N° productos
        └── Categoría          ← agrupación semántica
              └── Pestaña      ← tab visible en el POS (máx 20 chars)
                    └── Botón  ← tile específico en la pestaña
```

**Insight:** los primeros 3 niveles son **taxonomía admin** (reportes, filtros, inventario). Los últimos 2 son **UX operativa** (lo que ve el cajero). **Pestañas y Botones son configurables por drag&drop** en Sistema → Productos → Botones ("Reordenar Botones" es un CTA visible cuando hay conflicto).

Comparar con SistecPOS actual: usamos `categories` como taxonomía única + `POSCategoryTabs`. Falta:
- **Concepto de Marca separada de Categoría** (para reportes por proveedor).
- **Fabricante como nivel superior** (útil para supermercados con líneas propias vs distribuidas).
- **Botón como entidad configurable** con orden persistido — hoy el orden de tiles es implícito (order de `products.sort_order`), no editable en UI.

## Módulos disponibles (mapa completo del sitemap)

**manual-pos** (11 secciones):
- Introducción · Facturación (5 subs) · Administración (6 subs) · Reportes (4 subs) · Terceros (3 subs) · Herramientas (4 subs) · Sistemas (2 subs) · Actualizaciones · Errores conocidos · Preguntas frecuentes.

**manual-admin** (11 secciones adicionales de backoffice):
- Cuentas (por cobrar / por pagar / historial) · Documentos (Comprobantes de egreso pendientes/realizados + Recibos de caja pendientes/realizados) · Proveedores (Orden de compra + Ajustes) · Reportes (9 sub-reportes: costos, cuentas x pagar, detalles compras, histórico CXC, registros borrados, retenciones, etc.) · Alertas del sistema · Actualizaciones.

**Insight arquitectural clave:** Kodigo separa **POS (operativo)** y **Admin (backoffice)** en dos manuales completamente distintos, no como pestañas o secciones del mismo workspace. El cajero nunca ve ni el UI de Cuentas x Cobrar ni el de Retenciones — son mundos aparte con roles distintos.

Comparar con SistecPOS Core: actualmente mezclamos admin y POS en el mismo shell (`/admin` y `/pos` comparten sidebar). El modelo Kodigo sugiere separación física — dos apps montadas en subdominios distintos o al menos con **navegación mutuamente excluyente** por rol.

## Terceros (Clientes + Proveedores) — patrón unificado

- Mismo formulario para crear/buscar (por N° documento) — ver `kodigofuente-pos-flows`.
- Estados de cuenta separados como reporte propio.
- Proveedor tiene su propio menú (no compartido con cliente).

## Herramientas (4 utilidades específicas de supermercado)

1. **Balanza** — conexión a báscula electrónica.
2. **Imprimir flejes** — etiquetas de precio de góndola.
3. **Separatas** — apartados con abono.
4. **Visor de precios** — pantalla auxiliar cliente-visible con precio.

Todos hiper-específicos del nicho supermercado. No hay "herramientas genéricas" — cada tool tiene un uso operativo claro.

## Cómo aplicarlo a SistecPOS Core

- **Feature flags visibles en Configuración → Sistema** (hoy están dispersos en `useFeatureFlags`).
- **Fabricante + Marca como entidades separadas de Category** en `products` (ampliar schema: `manufacturer_id`, `brand_id`).
- **Editor visual de Pestañas/Botones** (`POSTabsEditor`) — hoy sólo se pueden reordenar productos, no las pestañas mismas.
- **Habilitación electrónica DIAN** como flujo guiado similar (ya lo tenemos parcialmente en `EinvoiceConfigWizard` — comparar UX).
- **Herramientas específicas por nicho**: para SistecPOS Core (multi-nicho) considerar exponer herramientas condicionales por `business_type` — báscula y flejes sólo para supermercado, KDS y mesas sólo para food, etc.

## Referencias

- https://docs.kodigofuente.com/docs/manual-pos/sistemas/configuracion (9412 chars — el más rico de configuración)
- https://docs.kodigofuente.com/docs/manual-pos/administracion/crearProducto (11669 chars)
- https://docs.kodigofuente.com/docs/manual-pos/terceros/clientes
- https://docs.kodigofuente.com/docs/manual-pos/herramientas/{balanza,imprimirflejes,separatas,visorPrecios}
- https://docs.kodigofuente.com/docs/manual-admin/* (segundo manual de backoffice completo)
