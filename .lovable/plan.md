# Auditoría + Plan de Refactor a Arquitectura Hexagonal

Modo: **solo diagnóstico**. No se toca ningún archivo en este turno.

---

## A. Reporte de Hallazgos (Deuda Técnica)

### Métricas rápidas
- **109 archivos** dentro de `src/modules/**` invocan directamente `supabase.from(...)` o `supabase.rpc(...)` desde la capa de presentación.
- `src/core/` e `src/infrastructure/` **no existen** todavía — la separación exigida por la base de conocimiento aún no está materializada.
- **Zustand no está instalado** (`package.json` no lo lista). El estado del carrito y de la sesión POS vive en React Context + `useState`, lo que fuerza re-renders y bloquea la reactividad "tipo escritorio".
- `src/modules/pos/components/` tiene **50 componentes** y `POSWorkspace.tsx` pesa **2.370 líneas** — el clásico anti-patrón "God Component".

### Top 3 archivos con mayor acoplamiento (riesgo alto)

| # | Archivo | LOC | Problema |
|---|---------|-----|----------|
| 1 | `src/modules/pos/components/POSWorkspace.tsx` | 2.370 | Orquesta UI + hotkeys + estado de venta + llamadas a Supabase + lógica fiscal + impresión. Un solo cambio puede romper caja, mesas, KDS y facturación electrónica a la vez. |
| 2 | `src/modules/cart/context/CartContext.tsx` | 283 | Mezcla cálculo de subtotal/total/impuestos con persistencia (`persistent_carts`), sync remoto y storage local. La misma clase decide "qué es un carrito" y "cómo se guarda". |
| 3 | `src/modules/pos/pages/POS.tsx` + `Mesas.tsx` + `KDS.tsx` | ~99 c/u | Páginas que consultan Supabase directo para sesiones, mesas y tickets — la lógica de dominio (¿puede abrir turno? ¿mesa disponible?) vive en el JSX. |

Otros focos calientes: `ParkedTicketsSheet`, `CloseSessionDialog`, `InvoiceActionsDialog`, `TableOrderDrawer` — cada uno resuelve reglas de negocio dentro del componente.

### Riesgos si movemos código sin plan
- **Cálculos financieros** (impuestos IVA, propina, descuentos, redondeo COP): están duplicados entre `CartContext`, `POSWorkspace` y el payload de checkout WhatsApp de Astro. Riesgo de divergencia → totales distintos en pantalla vs. factura vs. WhatsApp.
- **Payload WhatsApp**: la construcción del mensaje vive en la UI del cliente y también en `astro-starter/src/pages/api/checkout.ts`. Dos fuentes de verdad = bug fiscal esperando ocurrir.
- **Auth + roles**: `AuthContext` mezcla lectura de sesión, cache de roles, telemetría, dev-bypass y realtime broadcast. Refactorizar sin contrato claro puede tumbar login en producción.
- **Realtime + offline outbox**: cualquier movimiento sin puertos (`ports`) rompe la sincronización POS ↔ Cloud.

### Estado del estado global
- **Carrito**: React Context re-renderiza todo el árbol al agregar 1 producto. En hardware POS de gama baja se percibe lag.
- **Sesión POS**: hooks separados (`usePOSModes`, `useRecentActions`, `useEinvoiceLiveStatus`, etc.) hacen fetch independiente → múltiples requests a Supabase por interacción.
- **Sin store en memoria**: cada mutación espera respuesta HTTP antes de reflejar cambio visual → viola el principio de "instantáneo tipo .NET/WinForms" de la guía.

### Entidades implícitas a extraer a `core/domain/entities/`
- `Product` (id, sku, precios por lista, presentaciones, stock, impuestos aplicables).
- `CartLine` + `Cart` / `Ticket` (líneas, totales, propina, descuento, cliente).
- `Money` como Value Object (monto + moneda + redondeo COP).
- `TaxRule` / `TaxBreakdown` (IVA, INC, retenciones).
- `PosSession` (turno de caja: apertura, arqueo, cierre, denominaciones).
- `Payment` (efectivo, tarjeta, transferencia, mixto).
- `Customer` (CLI-XXXX, tipo negocio, lista de precio asignada).
- `Order` / `Invoice` (con estado DIAN, CUFE, tipo documento).
- `UserRole` (superadmin > admin > editor > agente > user).

### Fricciones UX / hardware detectadas
- POS **no** aplica `h-screen w-screen overflow-hidden` de forma consistente — algunas rutas heredan scroll global del layout web, lo que produce el "jitter" ya documentado en memoria.
- Botones táctiles debajo de los **44px mínimos** en varios diálogos (`InvoiceActionsDialog`, `CustomerQuickDialog`).
- Admin/Catálogo usa tablas anchas en vez de vertical cards (viola regla móvil-first).
- Hotkeys F2/F5/ESC existen (`usePOSHotkeys`) pero conviven con `onClick` que hacen fetch — se pierden si Supabase responde lento.

---

## B. Mapa de Carpetas Propuesto

```text
src/
├── core/                                # 0% React · 0% Supabase · 100% TS puro
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Product.ts
│   │   │   ├── Cart.ts               ← extraído de CartContext
│   │   │   ├── Ticket.ts
│   │   │   ├── PosSession.ts
│   │   │   ├── Payment.ts
│   │   │   ├── Customer.ts
│   │   │   ├── Order.ts
│   │   │   └── UserRole.ts
│   │   └── value-objects/
│   │       ├── Money.ts              ← redondeo COP centralizado
│   │       ├── Tax.ts                ← IVA / INC
│   │       └── Discount.ts
│   ├── use-cases/
│   │   ├── cart/
│   │   │   ├── AddProductToCart.ts
│   │   │   ├── RemoveLine.ts
│   │   │   ├── ApplyDiscount.ts
│   │   │   └── ComputeTotals.ts      ← fuente única de verdad
│   │   ├── pos/
│   │   │   ├── OpenSession.ts
│   │   │   ├── CloseSession.ts
│   │   │   ├── ProcessPayment.ts
│   │   │   └── ParkTicket.ts
│   │   ├── checkout/
│   │   │   └── BuildWhatsAppPayload.ts  ← unifica web + Astro
│   │   └── invoicing/
│   │       ├── EmitElectronicInvoice.ts
│   │       └── ResendInvoice.ts
│   └── ports/
│       ├── ICartRepository.ts
│       ├── IProductRepository.ts
│       ├── IPosSessionRepository.ts
│       ├── IInvoiceGateway.ts
│       ├── IHardwareService.ts       ← impresora, báscula, scanner
│       └── IMessagingGateway.ts      ← WhatsApp
│
├── infrastructure/                      # Adaptadores técnicos
│   ├── database/
│   │   ├── SupabaseProductRepository.ts
│   │   ├── SupabaseCartRepository.ts
│   │   └── SupabasePosSessionRepository.ts
│   ├── hardware/
│   │   ├── WebUSBEscPosAdapter.ts
│   │   ├── WebSerialScaleAdapter.ts
│   │   └── ElectronBridgeAdapter.ts     ← re-encapsula electronBridge.ts
│   ├── messaging/
│   │   └── WhatsAppGateway.ts
│   └── invoicing/
│       └── InnapsisDianAdapter.ts
│
└── presentation/                        # UI intercambiable
    ├── modules/                         # (renombrado desde src/modules/*)
    │   ├── pos/
    │   ├── admin-cms/
    │   ├── storefront/
    │   ├── superadmin/
    │   ├── clientes/
    │   └── ...
    ├── store/                           # Zustand
    │   ├── useCartStore.ts
    │   ├── usePosSessionStore.ts
    │   └── useUiPreferencesStore.ts
    └── shared/ui/                       # shadcn wrappers, Numpad, CartList
```

Regla dura: **presentation nunca importa desde infrastructure**; sólo consume `core/use-cases` y `core/ports`. La composición (qué adapter concreto usar) se hace en `src/main.tsx` mediante un contenedor liviano.

---

## C. Plan de Ejecución en 4 Fases (Zero-Breaking-Changes)

Cada fase termina con: `tsgo --noEmit` verde, `vitest run` verde, e2e Playwright verde, feature flag para poder revertir.

### Fase 1 — Aislamiento del Dominio (1-2 iteraciones)
**Objetivo:** extraer matemática pura sin tocar UI.

1. Crear `src/core/domain/value-objects/Money.ts` y `Tax.ts` con tests unitarios (redondeo COP, IVA 19%, INC 8%).
2. Crear `src/core/use-cases/cart/ComputeTotals.ts` como función pura `(lines, taxRules, discount) → { subtotal, tax, total }`.
3. Crear entidades `Cart`, `CartLine`, `Product` (tipos + factories, sin métodos I/O).
4. En `CartContext.tsx` **reemplazar el cálculo inline por una llamada a `ComputeTotals`** — misma firma pública, cero cambios para consumidores.
5. Definir `ports/` (interfaces vacías) para poder inyectar mocks en tests.

**Verificación:** los tests actuales de `CartContext.test.tsx` deben seguir pasando sin modificarse.

### Fase 2 — Adaptadores de Infraestructura
**Objetivo:** dejar de importar `supabase` desde componentes.

1. Crear `SupabaseCartRepository` que implemente `ICartRepository` reproduciendo exactamente los llamados actuales a `persistent_carts` / `cart-sync`.
2. Crear `WhatsAppGateway` que unifique el payload — mover `BuildWhatsAppPayload.ts` al core y hacer que **tanto el cliente React como `astro-starter/api/checkout.ts` lo consuman**.
3. Crear `InnapsisDianAdapter` que absorba las llamadas actuales a edge functions de facturación.
4. **Codemod dirigido**: reemplazar `supabase.from('carts')...` en los 109 archivos por `useRepository()` hooks, uno a uno, dominio por dominio (cart → pos-session → invoice → catalog). Cada PR toca un solo dominio.

**Verificación:** e2e `checkout.spec.ts` y `pos.spec.ts` verdes; snapshot de payload WhatsApp idéntico antes/después.

### Fase 3 — Conexión de Zustand
**Objetivo:** reactividad instantánea sin esperar red.

1. `bun add zustand`.
2. Crear `presentation/store/useCartStore.ts`: estado local con `addLine`, `removeLine`, `setDiscount` que llaman inmediatamente a `ComputeTotals` (puro, sync) y luego dispara `SupabaseCartRepository.persist()` en background (fire-and-forget con reconciliación).
3. Migrar `CartContext` → wrapper delgado sobre el store (mantiene API pública para no romper consumidores).
4. Crear `usePosSessionStore` que consolide los múltiples hooks (`usePOSModes`, `useRecentActions`, etc.) en un único store con selectores.
5. Optimistic UI: numpad, agregar producto y aplicar descuento reflejan cambios en <16 ms.

**Verificación:** medir con Performance panel — interacciones <100 ms INP. Fallback: si el store detecta error de persistencia, revierte y muestra toast.

### Fase 4 — Modernización de Vistas
**Objetivo:** aplicar las reglas visuales de la guía sin tocar lógica.

1. POS Workspace: forzar `h-[100dvh] w-screen overflow-hidden`, scroll sólo interno en grilla productos y carrito.
2. Romper `POSWorkspace.tsx` (2.370 LOC) en sub-vistas por panel (`ProductGrid`, `CartPanel`, `PaymentPanel`, `SessionHeader`) — todas consumen el store, no fetchean.
3. Aplicar tamaños táctiles 44-56 px en diálogos y numpad.
4. Admin/Catálogo: tablas anchas → `VerticalCard` responsive.
5. Rediseño visual (tokens semánticos, tipografía DSEG7 ya en memoria, color primario `#0C4B83`) — puramente cosmético.

**Verificación:** Lighthouse LCP POS <1.5 s, ninguna regresión en e2e, capturas antes/después.

---

## Guardrails transversales

- **Feature flags** por fase: `refactor.core-domain`, `refactor.infra-adapters`, `refactor.zustand-store`, `refactor.ui-modernization`. Permite apagar cualquier fase en Live sin revert.
- **Contratos primero**: cada PR abre con el archivo de `ports/` + tests unitarios antes de la implementación.
- **Un dominio por PR**: nunca mezclar cart + invoicing en la misma iteración.
- **Baseline actualizado** en `docs/refactor-baseline.md` al cierre de cada fase (LOC, cobertura, bundle, INP).
- **Rollback plan** documentado: cada fase debe poder revertirse con `git revert` de un único merge commit + apagar flag.

---

## Próximo turno sugerido
Aprobar el plan y arrancar **Fase 1 paso 1**: crear `Money.ts` + `Tax.ts` + `ComputeTotals.ts` con sus tests, sin tocar la UI. Es el commit con menor riesgo y máximo valor (elimina la duplicación de cálculo fiscal entre web, POS y WhatsApp).
