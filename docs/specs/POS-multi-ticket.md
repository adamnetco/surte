# POS — Multi-ticket Simultáneo (Tabs paralelas)

**Estado:** IN_SPEC
**Módulo:** `pos`
**Wave:** 3 — Daily Driver UX (NORTE/camino-a-produccion)
**Tablas afectadas:** `parked_tickets` (ya existe), nueva columna `is_active_tab` o nueva tabla `pos_ticket_tabs`
**Inspiración competitiva:** Alegra POS (Venta 1 / Venta 2 / +) — GAP crítico vs Vector/POSCOL/Cabal

## Problema

Hoy en `/pos` el cajero opera **un solo carrito a la vez**. Si entra un segundo cliente mientras el primero está decidiendo, debe:
1. Aparcar manualmente el ticket (Suspender / F8).
2. Cobrar al cliente 2.
3. Recuperar el ticket aparcado desde lista modal.

Esto genera fricción en:
- **HORECA en barra** (rotación alta, varios pedidos solapados).
- **Minimercado en hora pico** (2-3 clientes esperando).
- **Casas de cambio** (cotización USD mientras otro paga COP).

Alegra resolvió con **tabs paralelas tipo navegador** (Venta 1 | Venta 2 | + nueva). Cada tab mantiene su propio carrito, cliente, lista de precios, descuentos, totales, sin perder estado al cambiar.

## Outcomes

### Tabs UI
- [ ] **AC1:** Barra superior de tabs en `/pos` con: tab activa resaltada, contador de items por tab, botón `+` para crear nueva, botón `×` por tab (con confirm si tiene items).
- [ ] **AC2:** Soporta hasta **6 tabs simultáneas** (límite UX, configurable por `app_settings`).
- [ ] **AC3:** Atajo teclado: `Ctrl+T` nueva tab, `Ctrl+W` cerrar tab actual, `Ctrl+1..6` saltar a tab N, `Ctrl+Tab` ciclar.
- [ ] **AC4:** Tab nombrable inline (doble click): default "Venta 1", editable a "Mesa 5" / "Juan" / "USD-Quote".

### Persistencia de estado
- [ ] **AC5:** Cada tab persiste en `parked_tickets` con flag `is_active_tab=true` (vs aparcados manualmente que tienen `is_active_tab=false`).
- [ ] **AC6:** Estado completo por tab: items, qty, modificadores, cliente seleccionado, lista de precios, descuento global, notas, presentación elegida.
- [ ] **AC7:** Al recargar la página o cambiar de cajero (lock screen), las tabs activas se restauran desde DB en el orden previo.
- [ ] **AC8:** Multi-device safe: si dos cajeros usan el mismo `cash_register_id`, cada uno ve solo sus propias tabs (filtro por `created_by`).

### Workflow integraciones existentes
- [ ] **AC9:** "Aparcar ticket" (F8) sigue funcionando — mueve el tab activo a la lista de aparcados (toggle `is_active_tab=false`) y libera el slot.
- [ ] **AC10:** "Recuperar aparcado" abre el ticket como **nueva tab** (no reemplaza la activa).
- [ ] **AC11:** Cobrar (F2) cierra solo la tab activa y crea automáticamente una nueva tab vacía "Venta N+1" si era la única, o salta a la siguiente.
- [ ] **AC12:** Cancelar ticket (limpiar carrito) NO cierra la tab — solo vacía contenido.

### Edge cases
- [ ] **AC13:** Si una tab queda inactiva >4h, badge ámbar "Inactiva 4h" + opción rápida de aparcar/descartar.
- [ ] **AC14:** Modo offline (Dexie) replica tabs en IndexedDB; al volver online sincroniza con `parked_tickets`.
- [ ] **AC15:** Si el cajero excede 6 tabs e intenta `+`, toast: "Máximo 6 ventas paralelas. Aparca o cobra una para continuar."

## Schema DB

```sql
ALTER TABLE parked_tickets
  ADD COLUMN is_active_tab BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN tab_position SMALLINT,           -- 1..6, orden de la barra
  ADD COLUMN tab_label TEXT,                  -- nombre custom; null = "Venta N"
  ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX idx_parked_active_tabs
  ON parked_tickets (organization_id, cash_register_id, created_by, tab_position)
  WHERE is_active_tab = true;
```

RLS: hereda las existentes de `parked_tickets` (filtro por `organization_id` + `created_by`).

## Componentes

- `src/modules/pos/components/POSTabBar.tsx` — barra superior con tabs.
- `src/modules/pos/hooks/usePOSTabs.ts` — gestiona array de tabs, tab activa, atajos.
- `src/modules/pos/hooks/useTabPersistence.ts` — sync con `parked_tickets` (debounced 500ms).
- Modificar `src/modules/pos/context/CartContext.tsx` → leer/escribir el carrito de la tab activa.

## Métricas de éxito

- **Adopción:** ≥40% de organizaciones HORECA/Minimercado usan ≥2 tabs en simultáneo durante hora pico (medido vía `usage_events`).
- **Reducción de fricción:** Tiempo entre "abrir ticket cliente 2" y "cobrar cliente 1" baja de ~12s (con aparcado manual) a <2s.
- **Estabilidad:** 0 reportes de pérdida de carrito por crash/recarga en 14 días.

## Decisiones pendientes

1. ¿Color por tab (rojo/azul/verde) para identificar visualmente en barra? — Proponer: opcional, lo elige el cajero al renombrar.
2. ¿Sincronizar tabs entre dispositivos del mismo cajero? — Decisión: NO en v1 (complejidad alta, valor bajo). Cada device tiene sus propias tabs.
3. ¿Permitir mover items entre tabs (drag&drop)? — Decisión: NO en v1, evaluar en v1.1 según feedback.

## Fuera de scope (v1.1+)

- Compartir tab entre cajeros (handoff explícito).
- Tabs colaborativas en tiempo real (Realtime).
- Templates de tab predefinidos (ej. "Combo del día").

## Out-of-scope absoluto

- No reemplaza el flujo de **mesas HORECA** (que ya tiene su propio multi-pedido). Las tabs son para venta express en barra/mostrador.
