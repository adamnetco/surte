# Reporte de Revisión — POS-einvoice-hard-block-policy

**Fecha:** 2026-06-24
**Resultado general:** ✅ APROBADO CON OBSERVACIONES

## Criterios de Aceptación

| AC | Estado | Detalle |
|---|---|---|
| AC1 | ✅ | Migración aplicada: `einvoice_configs.hard_block_when_dian_down BOOLEAN NOT NULL DEFAULT false` + COMMENT. Verificado en `src/integrations/supabase/types.ts:2108,2136,2164` (Row/Insert/Update). |
| AC2 | ✅ | `POSBehaviorSettings.tsx:152-168` — Switch destructivo con icono `ShieldAlert`, badge "Recomendado para HORECA alto volumen" y descripción del trade-off (48h). Estado se persiste con `upsert` en columna dedicada (línea 66). |
| AC3 | ✅ | `PaymentDialog.tsx:263-318` — botón "Confirmar cobro" con `disabled={!canConfirm}` donde `canConfirm = … && gate.canCharge`. Tooltip exacto "DIAN offline. Configure rango de contingencia o espere a restablecimiento.". CTA secundaria a `/admin/facturacion/configuracion`. |
| AC4 | ✅ | `usePosCobroGate.ts:48` — `BYPASS_DOC_TYPES = {recibo_interno, sin_dian, ticket_pos}` corta el gate antes de bloquear. |
| AC5 | ✅ | `PaymentDialog.tsx:76-95` listener `Ctrl+Shift+B` con guard `isSuperadmin && !gate.canCharge`. `usePosCobroGate.activateOverride` (líneas 112-130) escribe `sessionStorage` TTL 30 min + inserta `sync_logs` con `service_name='pos_hard_block_override'`, status `warning` y payload {user_id, dian_health, has_contingency, activated_at, ttl_minutes}. Banner persistente rojo cuando override activo (`PaymentDialog.tsx:288-292`). |

## Verificación cruzada

- **Schema:** ✅ tipos regenerados (`Row | Insert | Update`).
- **Realtime:** ✅ hook se suscribe a `postgres_changes UPDATE einvoice_configs filter=organization_id=eq.<id>` para refrescar el flag sin recargar.
- **No regresión:** ✅ default `false` ⇒ tenants existentes no perciben cambio (caso QA #1).
- **Bypass doc type:** ✅ caso QA #5 cubierto vía set.
- **Auditoría:** ✅ `sync_logs.service_name='pos_hard_block_override'` (no `event_type`, ese campo no existe en la tabla — desviación menor del spec, columna correcta usada).
- **Superadmin guard:** ✅ doble: en el listener (`isSuperadmin && !gate.canCharge`) y en la UI del CTA terciario.

## Gaps críticos

Ninguno.

## Observaciones (no bloquean)

1. **Spec vs realidad de schema** — La sección "Diseño técnico" del spec menciona tabla `einvoice_contingency_ranges` y hook nuevo `useContingencyRangeStatus`. La implementación reutiliza el JSON `einvoice_configs.contingency_range` vía `useDianHealth().hasContingencyRange` (decisión ya documentada en "Implementación (Build)" del spec). Si en el futuro se materializa la tabla dedicada, el gate sólo cambia un import.
2. **`event_type` vs `service_name`** — Spec dice `sync_logs.event_type='hard_block_override'`. La tabla real usa `service_name` (no hay columna `event_type`). Se documentó la divergencia en el spec.
3. **Sin test E2E** del flujo bloqueado → override → cobro. Recomendado un smoke con Playwright que mockee `dian_health='offline'` + `contingency_range=null` y verifique tooltip + Ctrl+Shift+B (no bloqueante).
4. **Realtime para override** — el override vive en `sessionStorage`; otra pestaña/dispositivo del mismo superadmin NO ve el override. Aceptable porque es per-device por diseño; mencionarlo en el manual de cajero.
5. **`SaleCompleteDialog`** — el spec mencionaba ambos diálogos. El gate sólo se aplicó en `PaymentDialog` porque `SaleCompleteDialog` es post-emisión (no decide cobro). Se justificó en el spec.
6. **CTA "Forzar cobro (override)"** — el spec sugería un botón terciario explícito para superadmin además del atajo. Se implementó sólo el atajo con mención visual ("Ctrl+Shift+B para forzar override"). Si UX prefiere botón visible, agregar `<Button variant=destructive>` arriba del kbd.

## Verdict

Aprobado para `SHIPPED`. Observaciones 3 y 6 sugeridas como follow-ups menores.
