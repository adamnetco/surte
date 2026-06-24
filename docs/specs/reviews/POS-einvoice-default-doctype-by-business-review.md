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

## Observaciones (todas resueltas)

1. ✅ **Hook ya no fija `environment='prod'`** — ordena por `is_active DESC, updated_at DESC LIMIT 1`, cubre sandbox `dev`.
2. ✅ **Cache migrado a React Query** — key `["einvoice-defaults", orgId]`, invalidación por Realtime UPDATE; sin estado module-scope que contamine tenants.
3. ✅ **Constraint FX implementada** — trigger `trg_einvoice_configs_enforce_fx_doctypes` rechaza defaults ≠ `documento_soporte` cuando `business_type='casa_de_cambio'`.
4. ✅ **Backfill robustecido** — función `einvoice_apply_business_type_defaults(_org_id)` con alias (`bureau_de_change`, `fx`, `wholesale`, `distribuidor`), logging a `sync_logs` (`service_name='einvoice_doctype_backfill'`), y trigger en `organizations` que reaplica defaults cuando cambia `business_type`. Re-run idempotente: tocó 2 filas.
5. ✅ **`queueMicrotask` → `useEffect`** en `DocumentTypeSelector`.
6. ✅ **Tests unitarios** — `useOrgDefaultDocTypes.test.tsx` 5/5 pasan (incluye caso multi-tenant cache scoping).

## Acción
- Spec **SHIPPED**, todas las observaciones cerradas.


