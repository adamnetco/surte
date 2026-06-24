---
name: Ola 3 Slice 3 — Notas Crédito/Débito
description: UI y backend para emitir NC/ND DIAN sobre facturas existentes, con motivo y referencia al documento original
type: feature
---

# Ola 3 — Slice 3: Notas Crédito/Débito

## Migración
- `electronic_invoices` ahora guarda: `reference_invoice_id`, `reference_cufe`, `reference_full_number`, `reference_issue_date`, `note_concept_code`, `note_concept_text`.
- Índice parcial `idx_einvoice_reference` cuando hay referencia.

## Edge function `innapsis-emit`
- Acepta nuevo body: `reference_invoice_id`, `note_concept_code`, `note_concept_text`.
- Si `document_type` ∈ {credit_note, debit_note} y hay `reference_invoice_id`:
  - Carga prefix/number/cufe/issue_date del original (valida pertenencia a la org).
  - Inyecta bloque `Fe.Referencia` en payload Innapsis v1.9 (TipoDoc, Prefijo, Folio, FechaEmision, Cufe, CodigoMotivoNota, DescripcionMotivoNota).
  - Persiste columnas de referencia en la NC/ND.

## UI `/admin/facturacion`
- `EmitNoteDialog.tsx`: selector NC/ND, motivo DIAN (códigos oficiales 1-6 NC, 1-4 ND), descripción opcional.
- Botón `FileMinus` aparece en facturas con status `sent`/`accepted` y `document_type=invoice` (no se permite NC sobre NC).
- Lista muestra "↳ Ref: <full_number>" cuando la fila es una NC/ND.

## Motivos DIAN
- **NC**: 1 Devolución parcial, 2 Anulación, 3 Rebaja/descuento, 4 Ajuste precio, 5 Rescisión, 6 Otros.
- **ND**: 1 Intereses, 2 Gastos por cobrar, 3 Cambio del valor, 4 Otros.

## Limitaciones actuales
- Emite por el total de la orden original (no soporta NC parcial vía UI; ajustar ítems desde el POS antes de emitir).
- No bloquea emitir múltiples NC sobre la misma factura (queda al criterio fiscal del usuario).
