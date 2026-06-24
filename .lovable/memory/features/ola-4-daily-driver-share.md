---
name: Ola 4 Slice 2 — Resumen del día compartible
description: Dialog en /admin/diario que genera snapshot del día como texto plano para WhatsApp + PNG descargable
type: feature
---
**Ola 4 — Slice 2 (Daily Driver UX)**

`DiarioShareDialog.tsx` (nuevo):
- Recibe el snapshot del día (`useDailySnapshot` data) + org/user + progreso checklist.
- Renderiza tarjeta visual blanca (referenciada con ref) con: ventas del día (verde), KPIs grid 3 cols (Pendientes / Errores DIAN / Bajo stock), top 5 stock crítico, progreso checklist.
- Textarea editable con el texto plano (sin emojis, dashes + colons) listo para WhatsApp.
- Acciones: Copiar (clipboard), PNG (`html-to-image` `toPng` pixelRatio:2, descarga `resumen-YYYY-MM-DD.png`), WhatsApp (`wa.me/?text=...`), Compartir nativo (si `navigator.share` disponible).

`Diario.tsx`:
- Botón "Compartir" en header (al lado de refresh), disabled hasta `hasData`.
- State `shareOpen` + montaje del Dialog al final del JSX.
- Reusa `firstName`, `currentOrg.name`, `doneCount`, `CHECKLIST_DEFS.length` ya en scope.

Cumple regla memoria `whatsapp-formatting`: plain text only, no emojis, separadores `---` y `-`.
