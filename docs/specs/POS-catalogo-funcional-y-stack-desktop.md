# SistecPOS Core — Catálogo funcional y stack de escritorio

Documento de referencia (no ejecuta cambios de código). Consolida:

1. Las funcionalidades clave esperadas de un POS/ERP de escritorio tradicional.
2. Su estado real en este proyecto.
3. El stack moderno equivalente (React + Tailwind + Electron/Tauri) y cómo lo aplicamos.

Convención de estado:

- **OK** — implementado y en uso.
- **Parcial** — base implementada, faltan piezas listadas.
- **Pendiente** — no implementado; requiere slice propio.

---

## 1. Funcionalidades clave del sistema

### 1.1 Ventas y caja

| Funcionalidad | Estado | Dónde / notas |
|---|---|---|
| Búsqueda ágil por código de barras o texto | OK | Catálogo en memoria con acceso O(1) por código; entrada del lector tratada como emulación de teclado |
| Efectivo con cálculo de cambio | OK | `PaymentDialog` (teclado físico + numpad conmutable) |
| Datáfono / transferencia | OK | Medios de pago múltiples por ticket |
| Cheques | Pendiente | Requiere medio de pago con datos de giro y vencimiento |
| Crédito a clientes | Parcial | Existe cliente asignado al ticket; falta cupo y bloqueo por mora en el cobro |
| Abonos / plan separe (apartados) | Pendiente | Modelo: pedido reservado + movimientos de abono + saldo |
| Puntos / fidelización | Parcial | Programa de lealtad y movimientos en base; falta redención dentro del cobro |
| Ventas en espera (múltiples carritos) | OK | Tickets suspendidos con sincronización y pantalla de tickets abiertos |
| Apertura de cajón monedero | OK | Pulso ESC/POS por agente local (pin 2/5) |
| Impresión de ticket térmico y formato carta | OK | Constructor de ticket + renderer de layout (58/80 mm) y salida documento |
| Cierres de caja / arqueo con detalle por medio de pago | OK | Sesiones de caja, conteo por denominación, sellado y verificación de cadena |
| Historial de arqueos | OK | Consulta por sesión con detalle e histórico |

### 1.2 Inventario y catálogo

| Funcionalidad | Estado | Notas |
|---|---|---|
| Variantes (talla / color / modelo) | Pendiente | Hoy se modela con presentaciones y productos hijos; falta matriz de variantes real |
| Lotes y fechas de vencimiento | OK | `product_lots`, consumo FEFO, hoja de lotes y alertas de vencimiento |
| Básculas / venta por peso | Parcial | Puerto de hardware definido; falta adaptador serial productivo y captura de peso en línea |
| Desagrupación: combos, six-pack, canastas | Parcial | Presentaciones con factor de conversión y descuento de stock; falta receta/BOM con explosión |
| Hasta 10 listas de precios por producto | OK | Listas de precios con ítems por producto y selección por cliente/tipo |
| Promociones por volumen (2x1, por fecha) | Parcial | Modificadores y precios escalonados; falta motor de promociones con vigencia |
| Importación/exportación masiva Excel | OK | Importación por lotes resiliente con fallback individual |
| Reportes PDF | Parcial | Documentos de venta e informes clave; falta suite de reportes configurable |

### 1.3 Administrativo y cartera

| Funcionalidad | Estado | Notas |
|---|---|---|
| Cuentas por cobrar (crédito, abonos, intereses, estado de cuenta) | Parcial | Gestión de mora/dunning y facturación de suscripción; falta cartera de clientes del comercio |
| Cuentas por pagar a proveedores | Parcial | Órdenes de compra y proveedores; falta agenda de pagos y saldos |
| Auditoría (bitácora de movimientos) | OK | Bitácoras de tenant, acciones críticas, anulaciones POS y ajustes fiscales |
| Roles y permisos por usuario | OK | RBAC con tabla separada de roles y función `has_role` (nunca en el perfil) |
| Respaldos automáticos | Parcial | Snapshot/exportación de tenant; falta programación automática y restauración guiada |

---

## 2. Stack original de este tipo de software (referencia)

- **Lenguaje/UI:** .NET Framework (C#/VB.NET) con WinForms o WPF; alternativamente Delphi/C++ Builder.
- **Base de datos:** motores locales ligeros — Firebird, MySQL/MariaDB, SQL Server Express, SQLite.
- **Hardware:** ESC/POS sobre COM/USB/red, drivers OPOS/Serial para básculas y lectores.

Esa arquitectura explica sus dos ventajas a replicar: **latencia sub-milisegundo** (datos locales) y **densidad visual con operación por teclado**.

---

## 3. Equivalencia moderna aplicada en SistecPOS Core

### 3.1 Runtime de escritorio y hardware

| Necesidad | Implementación actual | Alternativa evaluada |
|---|---|---|
| Ejecutable de escritorio | Electron (shell genérico multi-tenant, licencia + manifiesto cifrado, auto-update) | Tauri v2 (<60 MB RAM) — decisión y disparadores en `docs/desktop/slice-5-tauri-decision.md` |
| Impresión térmica | Bytes ESC/POS crudos vía agente local, WebUSB y Web Bluetooth; sin diálogo del navegador | `tauri-plugin-printer-v2` si se migra |
| Cajón monedero | Pulso ESC/POS por el mismo canal | igual |
| Básculas / puerto serie | Puerto `IHardwareService` definido; adaptador serial pendiente | `tauri-plugin-serialplugin` / Web Serial |
| Lector de código de barras | Captura global de búfer rápido (emulación de teclado) | — |

Guías operativas: `docs/desktop/run-local-desktop.md`, `docs/desktop/build-windows.md`, `docs/desktop/multitenant-runtime.md`.

### 3.2 Teclado y foco (estilo WPF)

| Patrón | Implementación |
|---|---|
| Atajos globales F1–F12 | Hotkeys globales del POS (cobrar, buscar, cantidad, espera, cancelar, arqueo) + barra de acciones inferior |
| Paleta de comandos | `cmdk` para búsqueda global de productos y acciones |
| Flujo Enter continuo (estilo FoxPro) | `useEnterFlow` |
| Navegación con flechas en grilla | `useGridKeyboardNav` (patrón roving tabindex) |
| Foco atrapado en el cobro | Diálogo de pago con foco confinado y entrada numérica directa |
| Bloqueo por PIN antes de cobrar | Gate obligatorio con auto-lock configurable y auditoría de eventos |

### 3.3 Rendimiento y UI densa

| Patrón | Implementación |
|---|---|
| Virtualización de listas y grillas | `@tanstack/react-virtual` en grilla de catálogo y tablas densas del admin |
| Renderizado progresivo | `useProgressiveList` para catálogos grandes |
| Paneles redimensionables | `react-resizable-panels` (catálogo / ticket) |
| Componentes densos accesibles | shadcn/ui + Tailwind, objetivos táctiles de 44–56 px en el POS |
| Presupuesto de rendimiento | `scripts/perf-budget.mjs` en CI (`docs/desktop/perf-budget.md`) |
| Tipografía numérica | Display de 7 segmentos para total/recibido/cambio |

### 3.4 Estado y persistencia local

| Capa | Implementación |
|---|---|
| Estado del ticket | `zustand` (`useCartStore`) como fuente de verdad, selectores atómicos, totales puros |
| Caché offline | Dexie v3 particionado por tenant (catálogo, tickets del turno, clientes frecuentes) |
| Cola de salida | Outbox idempotente por `client_uuid` con backoff y escalado a bitácora de conflictos |
| Commit de venta | RPC atómica `pos_sale_commit` (cabecera + ítems + pagos en una transacción) |
| Sincronización | Motor propio: push por lotes, pull incremental por cursor `updated_at`, tombstones, conflictos revisables |
| Motor local futuro | SQLite cifrado en Desktop (o PGLite en web) detrás de `ILocalCatalogRepository` |

Arquitectura de datos: `docs/architecture/local-first-tenant.md` — Supabase es plano de control (licencias, respaldo, administración central), la base local es plano operativo.

### 3.5 Backend y seguridad

- Postgres/Supabase con RLS estricta y `GRANT` explícito por tabla.
- Todo dato operativo lleva `organization_id`; índices compuestos con el tenant como primera columna.
- Roles en tabla separada, funciones `security definer` con `search_path` fijo.
- Auditoría de alcance de tenant automatizada: `scripts/audit-tenant-scope.mjs`.
- Detalle en `docs/database/tenant-first-hardening.md`.

---

## 4. Referencias de la industria con este enfoque

- **1Password 8** — cliente nativo reemplazado por frontend web empaquetado (Rust/Tauri), gran reducción de memoria.
- **DbGate** — millones de filas con virtualización extrema y operación por teclado.
- **Linear (Desktop)** — referente de navegación por teclado y paleta de comandos.
- **Zed / Spacedrive** — backend de bajo consumo con respuesta sub-milisegundo.

---

## 5. Brechas priorizadas (siguiente trabajo)

1. **Cartera de clientes del comercio** — crédito, abonos, intereses y estado de cuenta (habilita plan separe y cheques).
2. **Variantes reales** — matriz talla/color con SKU derivado y stock por combinación.
3. **Adaptador de báscula** — serial productivo detrás de `IHardwareService` y captura de peso en la línea del ticket.
4. **Motor de promociones** — 2x1 y descuentos con vigencia por fecha, evaluado en el cálculo de totales.
5. **Recetas/BOM** — explosión de combos y canastas con descuento de componentes.
6. **Respaldo programado y restauración guiada** por tenant.
7. **SQLite cifrado en Desktop** — solo si los disparadores de `slice-5-tauri-decision.md` se cumplen.
