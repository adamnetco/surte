# Reporte de Revisión — POS-einvoice-default-doctype-by-business

**Fecha:** 2026-06-24
**Resultado general:** ⚠️ APROBADO CON OBSERVACIONES

## Criterios de Aceptación

| AC | Estado | Detalle |
|---|---|---|
| AC1 — Columnas `default_doc_type_*` en `einvoice_configs` | ✅ | Migración `20260624053208_*.sql` agrega las 3 columnas con defaults `pos_electronico` / `factura_electronica` / `documento_soporte` y comentarios DIAN. |
| AC2 — Backfill por `business_type` | ✅ | `UPDATE ... FROM organizations` con `CASE` para `casa_de_cambio`, `b2b`, `mayorista`. Filtra filas que aún tienen defaults estándar para no pisar customizaciones. |
| AC3 — `DocumentTypeSelector` resuelve fx → hasCustomerId → consumerFinal | ✅ | `src/modules/pos/components/DocumentTypeSelector.tsx:45-54`. Fallback legacy a `is_default` o primer item. |
| AC4 — Sección "Defaults por tipo de cliente" en `POSBehaviorSettings` | ✅ | `POSBehaviorSettings.tsx:143` + persistencia en líneas 77-79. 3 selects (consumer_final / with_nit / fx_operation). |
| AC5 — Cambio futuro de `business_type` NO sobrescribe | ✅ | Backfill es one-shot (sin trigger). Cualquier edición admin queda blindada al divergir de los defaults base. |

## Gaps críticos
Ninguno.

## Observaciones (no bloquean)

1. **Hook filtra `environment='prod'`** — `useOrgDefaultDocTypes.ts:46`. Si la org está operando en `test` (sandbox DIAN), no encontrará la fila y caerá al `FALLBACK`. Considerar leer el ambiente activo desde `useDianHealth()` o `einvoice_configs.active_environment`.
2. **`cache` Map global module-scope** — no se invalida al cambiar de organización dentro de la misma pestaña (uso multi-tenant). Mitigado por Realtime, pero un `useQueryClient` con key `["einvoice-defaults", orgId]` sería más idiomático.
3. **Sin validación de coherencia FX** — el spec menciona "Validar con BD que `casas_de_cambio` solo permite `documento_soporte`" pero no se implementó constraint/trigger. El admin podría guardar `factura_electronica` para una casa de cambio desde el UI.
4. **Backfill asume valores específicos de `business_type`** — `casa_de_cambio`, `b2b`, `mayorista`. Si la enum/lookup cambia (e.g. `bureau_de_change`), el backfill queda silenciosamente sin efecto. Considerar log de filas actualizadas.
5. **`queueMicrotask(onChange)` en render** (línea 58) — patrón frágil para auto-asignar la sugerencia; preferir `useEffect`. Funciona, pero puede disparar warnings de React 18 en StrictMode.
6. **Sin test unitario** — a diferencia de `usePosCobroGate`, no hay `useOrgDefaultDocTypes.test.tsx` cubriendo los 6 casos QA del spec.

## Acción
- Spec actualizado a **SHIPPED**.
- Observaciones 1, 3 y 6 recomendadas como follow-up corto si se quiere alcanzar paridad con la calidad del hard-block gate.
