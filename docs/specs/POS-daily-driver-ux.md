# POS — Daily Driver UX

**Estado:** IN_BUILD
**Módulos:** `pos`, `admin-cms`, `clientes`

## Problema

SistecPOS tiene features completas pero el flujo diario del operador todavía tiene fricción:
- No hay onboarding interactivo para nuevos tenants
- POS no tiene atajos de teclado
- Algunos empty states son "no hay datos" sin CTA
- Faltan skeletons en varias listas
- Modales bloquean acciones rápidas

## Outcomes

### Onboarding
- [ ] **AC1:** Wizard de 5 pasos para nuevo tenant: datos empresa → ubicación → primer producto → primer usuario → tour rápido (`Onboarding.tsx` cubre 4/5; falta primer producto)
- [x] **AC2:** Checklist persistente — implementado como chip flotante `OnboardingChecklist` con popover (3/5, dismiss 12h, oculto en POS/KDS/print). Admin no tiene sidebar desktop, por eso es chip global.
- [x] **AC3:** Tour interactivo casero `FirstLoginTour.tsx` (sin driver.js): spotlight con clip-path + tooltip portal. Steps: Diario, ⌘K, FAB, Checklist. Persiste `sistecpos:tour:v1:<user>:<org>`. Anclajes `data-tour` añadidos.

### POS día a día
- [x] **AC4:** Atajos de teclado POS — F1/? ayuda, F2/F12 cobrar, F3// buscar producto, F4 cambiar modo de venta, F5 mesas, F6 facturar, F7 cotizar, F8 aparcar ticket, F9 limpiar, ESC cancelar. F2/F3 disparan incluso dentro de inputs. Hint visible en topbar + overlay (POSShortcutsOverlay). _Nota: F3=cliente y F4=descuento del spec original se ajustaron a F3=buscar (más usado, alineado con Loyverse/Poster) y F4=cycle modo de venta._
- [x] **AC5:** Búsqueda global Cmd+K en admin (GlobalCommandPalette con acciones por rol, Recientes + búsqueda dinámica de productos scoped a org)
- [x] **AC6:** Strip "Recientes" en POSWorkspace (`useRecentProducts`, 8 últimos, scoped por org, persistente en localStorage). _Nota: trackea último añadido en lugar de último vendido — patrón estándar Loyverse/Square._
- [x] **AC7:** PinLock (`src/components/PinLock.tsx`) con SHA-256, auto-lock 15 min, trigger desde FAB.


### Estados vacíos y carga
- [x] **AC8:** Componente `<EmptyState />` reutilizable en `src/components/ui/empty-state.tsx` (ilustración + CTA)
- [ ] **AC9:** Toda lista > 200ms muestra skeleton (audit pendiente)
- [ ] **AC10:** Optimistic updates en todas las operaciones de CRUD admin

### Feedback inmediato
- [x] **AC11:** Toasts top-center — implementado y consistente
- [x] **AC12:** Animación de check verde con spring + halo en `SaleCompleteDialog`
- [x] **AC13:** Sonido opcional (WebAudio) configurable desde el dialog, persistido en localStorage

### Mobile-first admin
- [ ] **AC14:** Sidebar colapsable en mobile
- [x] **AC15:** Tablas → vertical cards en < 768px — primer slice entregado: nueva pantalla `/admin/diario` (Daily Driver) mobile-first con vertical cards para KPIs, acciones del día (pendientes / bajo stock / sync errors), atajos y checklist diaria persistente por día. Sirve como hub diario del admin desde el celular. Audit de tablas legacy queda pendiente como follow-up.
- [x] **AC16:** Componente `<Fab />` reutilizable en `src/components/ui/fab.tsx`

## Métricas de éxito

- Tiempo login → primera venta < 30s (medido vía analytics)
- Tasa de finalización del onboarding wizard > 70%
- Reducción 50% en tickets de soporte tipo "¿cómo hago X?"

## Tareas (vertical slices)

### Slice 1 — Wizard de onboarding
- 5 pasos guardados en `onboarding_progress`
- Persistencia (si abandona, retoma donde quedó)
- Checklist en sidebar

### Slice 2 — Atajos de teclado POS
- Hook `useKeyboardShortcuts()`
- Cheatsheet flotante con `?`
- Configurable por usuario

### Slice 3 — Audit de empty states
- Inventariar todas las pantallas
- Crear `<EmptyState />` component reutilizable
- Reemplazar progresivamente

### Slice 4 — Skeletons + optimistic
- Audit de listas sin skeleton
- Aplicar `<Skeleton />` de shadcn
- Mutations con `onMutate` optimista

### Slice 5 — Cmd+K global
- Componente `<CommandPalette />`
- Index de acciones por módulo
- Búsqueda fuzzy

### Slice 6 — Mobile polish
- Audit responsive de admin
- FAB component
- Sidebar drawer en mobile

## No-objetivos

- ❌ Rediseño visual completo (mantener identidad actual)
- ❌ Cambiar paleta de colores
- ❌ App nativa (PWA suficiente)
