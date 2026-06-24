# POS — Default Doc Type por business_type

**Estado:** IN_BUILD
**Módulo:** `pos` (PaymentDialog/SaleCompleteDialog) + `admin-cms` (config)
**Wave:** Follow-up de [POS-innapsis-emision-pos](./POS-innapsis-emision-pos.md) (Observación #2 del review)
**Tablas:** `organizations.business_type`, `einvoice_configs.default_doc_type_*`

## Problema

Hoy el `DocumentTypeSelector` arranca con el último tipo elegido (o `pos_electronico` por defecto). En la práctica:

- **HORECA** (restaurantes, bares) → casi siempre `POS Electrónico` para consumidor final, `Factura Electrónica` cuando piden NIT.
- **B2B / Mayorista** → casi siempre `Factura Electrónica` con NIT obligatorio.
- **Casa de Cambio (FX)** → siempre `Documento Soporte` (operaciones no gravadas con IVA).
- **Minimercado / Casa** → `POS Electrónico` siempre.

Forzar al cajero a elegir cada vez introduce fricción y errores. Necesitamos una **matriz de defaults por `business_type`** configurable.

## Outcomes

- [ ] **AC1:** Nuevas columnas en `einvoice_configs`:
  - `default_doc_type_consumer_final` (default: `pos_electronico`)
  - `default_doc_type_with_nit` (default: `factura_electronica`)
  - `default_doc_type_fx_operation` (default: `documento_soporte`)
- [ ] **AC2:** Seeds automáticos según `organizations.business_type`:
  - `horeca` → consumer=`pos_electronico`, nit=`factura_electronica`
  - `b2b` → consumer=`factura_electronica`, nit=`factura_electronica`
  - `casa_de_cambio` → consumer=`documento_soporte`, nit=`documento_soporte`
  - `minimercado`, `casa` → consumer=`pos_electronico`, nit=`factura_electronica`
- [ ] **AC3:** `DocumentTypeSelector` lee defaults desde `einvoice_configs` y aplica según presencia/ausencia de NIT en el customer seleccionado.
- [ ] **AC4:** Sección en `POSBehaviorSettings`: "Defaults por tipo de cliente" con 3 dropdowns + preview del comportamiento.
- [ ] **AC5:** Si la organización cambia `business_type`, NO se sobrescriben los defaults ya personalizados (sólo seed inicial).

## Notas de Implementación

- Migración debe hacer backfill basado en `organizations.business_type` actual.
- Validar con BD que `casas_de_cambio` solo permite `documento_soporte` (constraint o trigger).
</content>
</invoke>
## Diseño técnico

### Schema (migración)

```sql
ALTER TABLE public.einvoice_configs
  ADD COLUMN IF NOT EXISTS default_doc_type_consumer_final TEXT NOT NULL DEFAULT 'pos_electronico',
  ADD COLUMN IF NOT EXISTS default_doc_type_with_nit       TEXT NOT NULL DEFAULT 'factura_electronica',
  ADD COLUMN IF NOT EXISTS default_doc_type_fx_operation   TEXT NOT NULL DEFAULT 'documento_soporte';

-- Backfill por business_type SOLO en filas que aún tengan defaults estándar (no pisar customizaciones).
UPDATE public.einvoice_configs c
SET default_doc_type_consumer_final = CASE o.business_type
      WHEN 'casa_de_cambio' THEN 'documento_soporte'
      WHEN 'b2b'            THEN 'factura_electronica'
      WHEN 'mayorista'      THEN 'factura_electronica'
      ELSE 'pos_electronico'
    END,
    default_doc_type_with_nit = CASE o.business_type
      WHEN 'casa_de_cambio' THEN 'documento_soporte'
      ELSE 'factura_electronica'
    END,
    default_doc_type_fx_operation = 'documento_soporte'
FROM public.organizations o
WHERE c.organization_id = o.id
  AND c.default_doc_type_consumer_final = 'pos_electronico'
  AND c.default_doc_type_with_nit = 'factura_electronica';
```

No requiere RLS extra (la tabla ya tiene políticas).

### Hook nuevo: `useOrgDefaultDocTypes(orgId)`

Retorna `{ consumerFinal, withNit, fxOperation, loading }`. React Query con cache 5 min + Realtime opcional.

### UI

- **`DocumentTypeSelector`**: nueva lógica de `suggested`:
  1. Si `module === 'fx'` → `fxOperation`.
  2. Si `hasCustomerId === true` → `withNit`.
  3. Else → `consumerFinal`.
  4. Fallback: `is_default` o primer item (legacy).
- **`POSBehaviorSettings`**: nueva sección "Defaults por tipo de cliente" con 3 `<Select>` (consumidor final / con NIT / operación FX) usando `useOrgDocumentTypes` para opciones disponibles.

### QA / Casos

1. Org HORECA recién creada → consumer=`pos_electronico`, nit=`factura_electronica`.
2. Org Casa de Cambio → consumer=`documento_soporte`, nit=`documento_soporte`, fx=`documento_soporte`.
3. Customer sin NIT → selector arranca con `consumer_final`.
4. Customer con NIT → selector arranca con `with_nit`.
5. Cajero cambia manualmente → el cambio se respeta hasta cerrar el dialog.
6. Admin cambia defaults en `POSBehaviorSettings` → próxima apertura del PaymentDialog refleja el nuevo default.

## Implementación

Archivos creados/modificados:
- `src/modules/pos/hooks/useOrgDefaultDocTypes.ts` (NEW)
- `src/modules/pos/components/DocumentTypeSelector.tsx` (lógica `suggested` actualizada)
- `src/modules/admin-cms/components/POSBehaviorSettings.tsx` (sección "Defaults por tipo de cliente")
