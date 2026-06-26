---
name: Ola 6 Slice I — Tour interactivo primer login (AC3)
description: FirstLoginTour casero sin driver.js. Spotlight con clip-path/box-shadow + tooltip portal posicionado, ancla por data-tour="<id>", dispara una vez por user+org en /admin o /admin/diario, persistencia en localStorage.
type: feature
---

# Ola 6 — Slice I (AC3)

`src/components/FirstLoginTour.tsx` montado en `App.tsx` (lazy).

## Mecánica
- Se activa 800ms después de montar si la ruta matchea `/admin` o `/admin/diario`
  y NO existe `sistecpos:tour:v1:<user.id>:<org.id>` en localStorage.
- 4 steps: `diario` → `command-palette` → `quick-actions` → `onboarding-checklist`.
- Cada step busca `[data-tour="<id>"]`; si no existe, tooltip se centra
  con backdrop completo y click-out lo cierra (skip implícito).
- "Saltar" o terminar persiste `done`/`skipped` en el scope.

## Anchors actuales
- `data-tour="diario"` — `Diario.tsx` h1.
- `data-tour="quick-actions"` — wrapper `QuickActionsFAB.tsx`.
- `data-tour="onboarding-checklist"` — wrapper `OnboardingChecklist.tsx`.
- `data-tour="command-palette"` — sin anchor (no hay botón visible),
  cae a tooltip centrado explicando `⌘/Ctrl + K`.

## Por qué sin driver.js
- Cero dependencias nuevas (~12KB ahorro).
- Total control sobre z-index y portal (coexiste con Sheet/Dialog).
- API simple para añadir steps: solo `data-tour="<id>"` en el target.
