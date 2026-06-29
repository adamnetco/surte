# SitricPOS Legacy Desktop — Batch 4 (15 capturas)

Origen: SITRIC POS escritorio (Windows .NET). Capturas en `.lovable/refs/sitricpos-batch4/`.
Foco: módulos de back-office tradicionales + workspace POS clásico, que **complementan** los batches 1-3 (workspace web, back-office moderno, settings/KDS).

## Top ribbon clásico (8 módulos)
`Modulo POS · Reportes · Productos · Compras · Empleados · Clientes · Traslados · Producción`
→ Mapa-mental del operador "viejo escolar". Nuestro sidebar debe ofrecer **vista clásica opcional** (modo perfil ≥40 años / negocio tradicional) sin renunciar al sidebar moderno.

## Workspace POS (cap 15) — 3 columnas
- **Izq:** ticket (Nombre, Cant, Valor_Prod, Desc) + header `MESA:5 | Cajero | Cod Venta | CC Cliente | Cliente GENERICO` + display XL `$:37.000` abajo.
- **Centro:** Action Rail vertical de **8 botones de color sólido**: Salir(rojo) · Asignar Cliente(verde) · Comentario(azul) · Descuento(naranja) · Multiplicar(morado) · Borrar(ocre) · Fin Venta(verde) · Servicio(morado).
- **Der:** Categorías (grid 5×N con foto+nombre) arriba + Productos (grid 5×N con **banda verde de precio arriba**, foto, nombre) abajo. Flecha XL ↓ para paginar. Search bar verde con icono teclado virtual.

→ **Confirma** patrón "Action Rail XL + Catálogo con banda-precio verde" que ya teníamos pendiente (Slice 3 de POSWorkspaceByType). El **teclado virtual** es nuevo: tablet sin teclado físico.

## Vista Mesas (cap 03) — restaurante clásico
- Grid 5×4 mesas oval con sillas dibujadas, badge verde (Disponible) / rojo (Ocupado) en esquina.
- Rail derecho con **acciones globales**, no por-mesa: `Venta Libre · Domicilio · Cambio Mesa · Abono Cliente · Consulta Factura · Pagos · Salir`.
- `Venta Libre` = ticket sin mesa (mostrador). `Domicilio` = slot delivery. `Cambio Mesa` = mover items entre mesas (ya soportado pero sin acceso prominente).

→ **Gap nuestro:** Nuestra vista Mesas no tiene rail global de acciones; las metimos en menús contextuales. Refactor: añadir rail derecho persistente con Venta Libre / Domicilio / Cambio Mesa.

## Customer Display XL (cap 02)
Pantalla independiente (segundo monitor) con **font 7-segment**:
- Valor Total Venta — azul XL
- Valor Recibido — verde XL
- Cambio — rojo XL
- Botones Imprimir `Sí / No`

→ Reusable para nuestro `POSCustomerDisplay.tsx` (Slice 5). Confirma elección de font 7-segment, colores azul/verde/rojo semánticos.

## Productos (caps 06,07,08)
- **Lista:** Cod_Producto, Nombre, Val_Venta, Tipo (VENTA/INSUMO), Categoria (numérica), Medida (UNIDAD/KILO/LITRO), **Captura** (MANUAL vs CODIGO BARRAS), IVA%, Valor_Costo.
- **Form alta:** Código Producto, Nombre, Tipo Producto, Tipo Medida, **Categoría con código numérico 0000-XXXX** (combo grande), F1 Valor Venta / F2 Valor Costo, Utilidad calculada, **Promoción Cantidad + Valor KILO Promoción**, Comanda (estación destino), Código de Barras (genera EAN visual con número grande), Foto.
- **Receta Producto (BOM)** [cap 08]: por producto compuesto, lista de ingredientes (Cod, Nombre, Cantidad, Medida). Permite descuento automático de inventario de insumos al vender el plato/combo.

→ **Gaps nuestros:**
1. No tenemos atributo `capture_method` (MANUAL/BARCODE) en `products` — útil para vendedores que escanean vs cajeros táctiles.
2. **Categoría con código numérico corto** para acceso por teclado en POS (escribir "0007" = bebidas calientes). Sería un campo `numeric_code` en `categories`.
3. **Recetas/BOM** existe parcial (`product_recipes`?) — verificar y, si no, planear módulo para `food` y `hybrid` (combos).
4. **Promoción por cantidad/peso** (precio especial al alcanzar X kg/unidades) — falta.

## Empleados (caps 01, 14)
- Lista: Cedula_E, Nombre, Cargo (ADMIN/CAJERO/PERSONAL), Usuario, **PermisoBorrar / PermisoAbrirCajon / Permiso_Devolucion** (SI/NO), Estado, Per_Mod_POS, Per_Mod_Admin.
- Form: Cedula, Nombre, Usuario+Contraseña, **Código Único** (PIN 4 dígitos para login rápido en POS), TipoUsuario (ADMIN/CAJERO/PERSONAL/VENDEDOR), Estado, **Habilitar como Vendedor** (SI/NO → aparece en lista de cajeros/vendedores POS), Foto (web cam "Tomar Foto"), bloque **Permisos MODULO POS** (4 checkboxes: Borrar / Consulta Facturas / Devoluciones / Abrir Cajón) + bloque **Permisos Modulo Administrador** (6 checkboxes uno por módulo).

→ **Gap nuestro:** Nuestro RBAC tiene roles globales (superadmin/admin/editor/user). Falta capa de **permisos granulares POS** (toggles atómicos: puede_borrar_linea, puede_dar_descuento, puede_abrir_cajon, puede_hacer_devolucion, puede_consultar_facturas_ajenas). Memo: `Ola 25 POS Hardening` ya tocó cierre ciego, pero NO permisos por acción. Slice nuevo propuesto: **POS Permission Matrix** con UI tipo tabla checkbox + enforcement en `pos_orders` triggers.

→ Confirma necesidad de **PIN 4 dígitos** ya implementado (Ola 6) — extender para login inicial al POS, no solo lock.

## Proveedores y Compras (caps 09, 10, 11, 12, 13)
- **Proveedor:** NIT/CC (con Enter para buscar DIAN), Nombre, Actividad, Dirección, Teléfono/Celular, Correo, NombreContacto, CelularContacto, **Cartera** (saldo acumulado a pagar).
- **Lista facturas compra:** filtros `Tipo Consulta = FACTURAS`, `Estado = TODOS/PENDIENTE/PAGADA`, rango Fecha. Columnas: Cod_Factura, NIT, Nombre_Prov, Fecha, Valor_Total, Valor_Iva19, Valor_Iva5, Valor_IpoConsumo, …
- **Form Compra (cap 12,13):** NIT Prov (Enter), Código Factura, Fecha, **Valor Total a Pagar**, IVA 19% / IVA 5% / **IpoConsumo** (impuesto al consumo Colombia) / Descuento, Tipo Pago (CONTADO/CRÉDITO), **Saldo Deuda** auto si crédito, **Origen Dinero** (CAJA/BANCO), bloque "Agregar Detalle Productos Factura" con línea Cod_Producto, Nombre, Categoria, Cantidad, Medida, Valor_Compra, Total, **Fecha_Vencimiento**.

→ **Gaps nuestros:**
1. `IpoConsumo` (8% en Colombia para bebidas/restaurantes) — falta como impuesto separable de IVA. Tabla `tax_rates` debería distinguir tipo.
2. **Vencimiento por línea de compra** (FEFO) — útil para alimentos perecederos y medicamentos. Hoy guardamos vencimiento por producto pero no por lote/recepción.
3. **Cartera Proveedor** consolidada — saldo pendiente por proveedor agregado, no solo factura-por-factura. Vista útil para Tesorería (CFO).
4. **Origen Dinero** en pagos a proveedores (CAJA/BANCO X/BANCO Y) — falta selector que afecte automáticamente movimiento contable y caja chica.

## Reportes Ventas (cap 04) — Consolidado Día (Cierre Z)
Filtros: Tipo Reporte (combo "00-Rept Consolidado Dia" entre muchos), Caja (TOTAL o caja específica), Cajero (TOTAL), Tipo Movimiento, Fecha Final, botón Actualizar.
Salida: Venta TOTAL, Descuentos, Devoluciones, **TOTAL Z**, Venta PLATAFORMAS (Rappi/Didi), Venta EFECTIVO, **DIF EFECTIVO** (diferencia caja vs sistema), SALDO CARTERA CLIENTE. Export Excel + PDF.

→ **Gap nuestro:** El reporte de cierre actual muestra detalle pero no este formato "TOTAL Z" condensado para impresión. Slice de **Cierre Z PDF/Excel oficial** estilo SitricPOS.

## Módulo Producción (en ribbon, no abierto en capturas)
Manufactura ligera: ensamblar productos compuestos a partir de insumos. Combinado con Recetas (BOM), permite a panaderías, restaurantes, embutidos consumir insumos y generar producto terminado en stock.

→ **Gap nuestro:** No existe módulo `production`. Crítico para `food` (cocina central) y `hybrid` (Salsamentaria SurteYa). Plantear `production_runs` (id, recipe_id, qty_output, status, posted_at) + descuento atómico de ingredientes vía RPC `apply_production_run()`.

## Resumen ejecutivo — Gaps por prioridad

| # | Gap | Tipo negocio impactado | Esfuerzo | Prioridad |
|---|-----|------------------------|----------|-----------|
| 1 | Action Rail XL POS (8 botones colores) | todos | M | **alta** (ya en plan Slice 3) |
| 2 | Customer Display XL 7-segment | retail/food | S | **alta** (Slice 5) |
| 3 | Rail acciones globales en vista Mesas | food | S | **alta** |
| 4 | Permisos granulares POS por empleado | todos | M | **alta** |
| 5 | Producción + BOM (recetas) | food, hybrid | L | **alta** food/hybrid |
| 6 | IpoConsumo separado de IVA | food | S | **media-alta** |
| 7 | Vencimiento por línea compra (FEFO/lotes) | hybrid, food | M | **media** |
| 8 | Categoría con código numérico para POS | todos | XS | **media** |
| 9 | `capture_method` MANUAL vs BARCODE | retail | XS | **baja** |
| 10 | Promoción por cantidad/peso | retail, hybrid | M | **media** |
| 11 | Cartera Proveedor consolidada | todos | S | **media** |
| 12 | "Origen Dinero" en pagos | todos | S | **media** |
| 13 | Cierre Z PDF/Excel formato oficial | todos | S | **alta** |
| 14 | Modo "Vista Clásica" (ribbon de 8 íconos) | usuarios senior | M | **opcional** |
| 15 | Teclado virtual en search POS | tablets sin teclado | S | **media** |

## Casos de uso ampliados por business_type

### `food` (restaurantes, cafés, panadería)
- Mesas con rail global (Venta Libre / Domicilio / Cambio Mesa)
- Recetas/BOM para platos compuestos
- Producción para cocina central / panadería matutina
- IpoConsumo en facturación
- Comanda con `comanda` field por producto → ruteo a estación KDS
- Cierre Z con desglose Plataformas (Rappi/Didi/iFood)

### `retail` (tienda barrio, ferretería, papelería)
- Captura por código de barras como default (`capture_method=BARCODE`)
- Catálogo en grid con banda-precio verde + paginación XL
- Promoción por cantidad (3x2, 5kg=10% off)
- Vencimientos por lote (medicamentos, alimentos)
- PIN cajero para login rápido

### `hybrid` (Salsamentaria, mayorista, distribuidora)
- **Producción** crítico (despresar carne, empacar)
- BOM para subproductos
- Compras con vencimiento por lote (FEFO)
- Cartera Cliente + Cartera Proveedor consolidadas
- Lista de precios por tipo cliente (Detal/Mayorista/Distribuidor) — ya implementado
- Traslados entre bodegas/sucursales (ya parcial)

### `services` (peluquería, taller, consultorio)
- Action Rail simplificado (sin Multiplicar/Comanda)
- Agenda por hora (cap del batch 1 confirma) como home
- Sin inventario / sin recetas / sin producción
- Comisiones por empleado vendedor (`Habilitar como Vendedor=SI`)
- Cierre Z simple sin desglose plataformas

### `pharmacy` (nuevo tipo sugerido)
- Vencimiento por lote OBLIGATORIO (Invima)
- Búsqueda por principio activo
- Receta médica adjunta a venta
- Reporte controlados (monopolio Fondo Nacional Estupefacientes)

→ Sugerir añadir `business_type='pharmacy'` y `business_type='services'` (este último ya existe en POS-primer pero sin slices propios).
