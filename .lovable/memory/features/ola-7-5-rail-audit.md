---
name: POSRightRail Audit (post Top Ribbon)
description: Auditoría tras introducir POSTopRibbon — quitar duplicados del mini-rail derecho. Suspender(F8) y Atajos(?) ya viven en el ribbon/hotkey; el rail conserva sólo NC, Ventas día, Cajón, Sync con badge, Recientes y Cierre Z.
type: feature
---

# Auditoría POSRightRail vs POSTopRibbon

Tras la Fase 1 (POSTopRibbon) se removieron del rail derecho los botones duplicados:

- ❌ **Suspender (Pause)** — ya existe como `F8` en POSTopRibbon.
- ❌ **Atajos (Keyboard)** — accesible con hotkey `?` y botón F1 inline del catálogo.

Se mantienen como accesos únicos de alta frecuencia:

- ✅ Notas crédito / Devolución
- ✅ Ventas del día (drawer rápido sin salir del POS)
- ✅ Cajón monedero
- ✅ Refresh + badge ámbar `pendingCount` (sync outbox)
- ✅ RecentActionsPopover (replay últimas 8 acciones)
- ✅ Cierre Z (acción destructiva, color destructive)

Props `onPark` y `onOpenShortcuts` se conservan **opcionales** en la interfaz por
compatibilidad con tests/consumers existentes, pero NO se renderizan. Si en el
futuro se quita el TopRibbon en algún workspace (ej. modo super-compacto), se
pueden volver a habilitar.
