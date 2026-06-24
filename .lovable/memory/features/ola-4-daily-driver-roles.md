---
name: Ola 4 Slice 3 — Checklist por roles
description: Plantillas de checklist diario por rol (admin/cajero/mesero/cocina/agente) con selector y progreso aislado por plantilla
type: feature
---
# Ola 4 Slice 3 — Checklist por roles + plantillas

`src/modules/admin-cms/lib/checklistTemplates.ts` define 5 plantillas (`admin`, `cashier`, `waiter`, `kitchen`, `agent`) con `item_key` prefijado por rol (`adm_*`, `caj_*`, `msa_*`, `coc_*`, `agt_*`) para que el progreso por día/org/usuario no se mezcle entre plantillas.

`Diario.tsx`:
- `templateForRole(currentOrg.role)` autoselecciona la plantilla sugerida.
- Override manual persistido en `localStorage["sistecpos:diario:tplKey"]`. Si no hay override, sigue el rol.
- Pills horizontales con badge "Tu rol" en la sugerida.
- `useDailyChecklist(activeTemplate.items)` reusa el hook existente sin tocarlo.
- `DiarioShareDialog` recibe `checklistTotal={activeTemplate.items.length}`.

Sin migraciones: `daily_checklist` ya guarda por `item_key`.
