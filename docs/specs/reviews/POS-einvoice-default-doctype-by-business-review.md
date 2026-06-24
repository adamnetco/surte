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

## Observaciones (resueltas en follow-up)

1. ✅ **Hook ya no fija `environment='prod'`** — ahora ordena por `is_active DESC, updated_at DESC LIMIT 1`, cubriendo tenants en sandbox DIAN (`dev`).
2. ⚠️ Cache `Map` global mantenido por simplicidad — invalidación vía Realtime UPDATE + helper `__resetOrgDefaultDocTypesCache` para tests. Migrar a React Query queda como mejora opcional.
3. ✅ **Constraint FX implementada** — trigger `trg_einvoice_configs_enforce_fx_doctypes` rechaza defaults ≠ `documento_soporte` cuando `business_type='casa_de_cambio'`.
4. ⚠️ Backfill sigue siendo silencioso si la enum de `business_type` cambia. Aceptable; el trigger nuevo es la red de seguridad principal.
5. ✅ **`queueMicrotask` → `useEffect`** en `DocumentTypeSelector` (sin warnings en StrictMode).
6. ✅ **Test unitario añadido** — `useOrgDefaultDocTypes.test.tsx`, 4/4 pasan.

## Acción
- Spec actualizado a **SHIPPED**.
- 4 de 6 observaciones cerradas; las 2 restantes (cache global, robustez del backfill) son mejoras menores no bloqueantes.

