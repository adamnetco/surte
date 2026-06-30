---
name: POSRightRail removido — acciones movidas al Sheet "Sesión POS"
description: Mini-rail vertical de 56px eliminado del POSWorkspace; sus 5 acciones + Recientes se reubicaron en el Sheet Settings del POSTopBar para liberar ancho útil del catálogo en tablet/desktop.
type: feature
---

# POSRightRail removido (refactor UX)

## Por qué
- Robaba 56px permanentes del catálogo en tablet/desktop (`md:pr-14` en el contenedor del workspace).
- Sus acciones tenían frecuencia media/baja: NC, Ventas día, Cajón, Refresh sync, Cierre Z + Recientes.
- Sync ya está visible inline en el TopBar (badge ámbar + botón flush).
- Suspender (F8) y Atajos (?) ya vivían en `POSTopRibbon` / hotkeys globales tras la auditoría Slice 7.5.

## Refactor aplicado
1. Eliminado `src/modules/pos/components/POSRightRail.tsx`.
2. Quitado `md:pr-14` del contenedor raíz de `POSWorkspace`.
3. `POSTopBar` ahora acepta prop `extraActions?: ReactNode`, renderizado dentro del Sheet "Sesión POS" entre "Ver atajos" y "Cierre Z" (separador `border-t`).
4. `POSWorkspace` pasa como `extraActions`:
   - Notas crédito / Devolución → `handleNotasCredito`
   - Ventas del día → `handleVentasDelDia`
   - Abrir cajón monedero → `handleCajon`
   - Sincronizar / Refrescar sync (con badge `pending`) → `handleRefresh`
   - `RecentActionsPopover` (replay últimas 8) en una fila con label.

## Qué NO se tocó
- Hotkeys F2-F8 del `POSTopRibbon`.
- `useRecentActions` + `RecentActionsPopover` (reutilizado).
- Sync widget inline en `POSTopBar` con badge ámbar (sin reflow).
- Cierre Z sigue accesible desde el mismo Sheet.

## Resultado
- +56px de ancho del catálogo en tablet/desktop (≈4% más espacio para tiles).
- Una sola superficie de acciones secundarias (Sheet), elimina duplicaciones.
- Mobile sin cambios (el rail ya estaba `hidden md:flex`).

Usé skills `code-review`, `frontend-UI-engineering`, `documentation-and-adrs`.
