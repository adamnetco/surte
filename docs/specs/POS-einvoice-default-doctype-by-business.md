# POS — Default Doc Type por business_type

**Estado:** DRAFT
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